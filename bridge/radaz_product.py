"""Offline, machine-bound licenses. Only the public RSA key ships to customers."""
import base64
import hashlib
import hmac
import json
import os
import re
import time
import uuid
from pathlib import Path
from threading import RLock
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from radaz_trial import TrialStore

ROOT = Path(__file__).resolve().parent.parent

def decode(value):
    if not isinstance(value, str) or not re.fullmatch(r'[A-Za-z0-9_-]+', value):
        raise ValueError('Açar kodlaması düzgün deyil')
    return base64.urlsafe_b64decode(value + '=' * (-len(value) % 4))

def verify_key(key, public, device, now=None):
    now = int(time.time()) if now is None else now
    if not isinstance(key, str) or len(key) > 7000:
        raise ValueError('Lisenziya açarı düzgün deyil')
    parts = key.strip().split('.')
    if len(parts) != 3 or parts[0] != 'RADAZ1':
        raise ValueError('RADAZ1 lisenziya açarı tələb olunur')
    n, e = int.from_bytes(decode(public['n']), 'big'), int.from_bytes(decode(public['e']), 'big')
    size = (n.bit_length() + 7) // 8
    sig = decode(parts[2])
    if size < 256 or len(sig) != size or int.from_bytes(sig, 'big') >= n:
        raise ValueError('Lisenziya imzası düzgün deyil')
    actual = pow(int.from_bytes(sig, 'big'), e, n).to_bytes(size, 'big')
    digest = bytes.fromhex('3031300d060960864801650304020105000420') + hashlib.sha256(f'RADAZ1.{parts[1]}'.encode('ascii')).digest()
    expected = b'\x00\x01' + b'\xff' * (size - len(digest) - 3) + b'\x00' + digest
    if not hmac.compare_digest(actual, expected):
        raise ValueError('Lisenziya imzası təsdiqlənmədi')
    claims = json.loads(decode(parts[1]))
    if not isinstance(claims, dict) or claims.get('v') != 1 or claims.get('product') != 'RADAZ':
        raise ValueError('Lisenziya bu məhsula aid deyil')
    if claims.get('deviceId') != device:
        raise ValueError('Açar başqa kompüterə aiddir')
    if claims.get('plan') not in ('monthly', 'yearly') or type(claims.get('seats')) is not int or not 1 <= claims['seats'] <= 1000:
        raise ValueError('Lisenziya paketi düzgün deyil')
    for field in ('issuedAt', 'expiresAt'):
        if type(claims.get(field)) is not int: raise ValueError('Lisenziya tarixi düzgün deyil')
    if claims['issuedAt'] > now + 300: raise ValueError('Kompüterin tarixini yoxlayın')
    if claims['expiresAt'] <= now: raise ValueError('Lisenziyanın müddəti bitib. Yeniləmə açarı alın.')
    if claims['expiresAt'] <= claims['issuedAt']: raise ValueError('Lisenziya müddəti düzgün deyil')
    if not all(isinstance(claims.get(k),str) and 0 < len(claims[k]) < 250 for k in ('licenseId','activationId','customer')):
        raise ValueError('Lisenziya məlumatı natamamdır')
    return claims

def atomic_json(path, data):
    temp = path.with_suffix('.tmp')
    with temp.open('w', encoding='utf-8') as stream:
        json.dump(data,stream,ensure_ascii=False); stream.flush(); os.fsync(stream.fileno())
    os.replace(temp,path)

class ProductService:
    def __init__(self, data_dir, config_path=None, public_path=None, device=None, trial_root=None):
        self.root = Path(data_dir) / 'product'; self.root.mkdir(exist_ok=True)
        self.config = json.loads(Path(config_path or ROOT/'public/product.json').read_text(encoding='utf-8-sig'))
        self.public_path = Path(public_path or ROOT/'public/license-public.json')
        self.lock = RLock(); self.cached_update = None; self.last_check = 0
        self.device = device or self.machine_id()
        self.trial = TrialStore(self.device, trial_root)

    def machine_id(self):
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r'SOFTWARE\Microsoft\Cryptography', 0, winreg.KEY_READ | winreg.KEY_WOW64_64KEY) as key:
                value = winreg.QueryValueEx(key,'MachineGuid')[0]
        except (ImportError, OSError):
            path = self.root/'machine-id'
            if not path.exists(): path.write_text(str(uuid.uuid4()), encoding='ascii')
            value = path.read_text(encoding='ascii')
        return hashlib.sha256(('RADAZ:v1:' + value).encode()).hexdigest().upper()

    def status(self):
        with self.lock:
            result = dict(valid=False,required=bool(self.config.get('licenseRequired',True)),deviceId=self.device,message='Lisenziya açarını daxil edin.')
            trial = self.trial.status() if self.config.get('trialDays') in (7, 30) else None
            path = self.root/'license.json'
            if path.exists():
                try:
                    saved = json.loads(path.read_text(encoding='utf-8'))
                    now = int(time.time())
                    if saved.get('lastSeen',0) > now + 300: raise ValueError('Kompüterin tarixi geriyə dəyişib. Tarixi düzəldin.')
                    claims = verify_key(saved['key'],json.loads(self.public_path.read_text()),self.device,now)
                    if now - saved.get('lastSeen',0) > 300: atomic_json(path,dict(key=saved['key'],lastSeen=now))
                    result.update(valid=True,claims=claims,message='Lisenziya təsdiqləndi.')
                    if claims.get('entitlement') == 'owner':
                        result.update(kind='owner', message='Bu kompüterdə bütün funksiyalar açıqdır — müddətsiz sahib lisenziyası.')
                except (ValueError, KeyError, OSError) as error:
                    result['message'] = str(error) if isinstance(error,ValueError) else 'Lisenziya məlumatı oxunmadı.'
            if trial is not None:
                result['trial'] = trial
                if not result['valid']:
                    result.update(valid=trial['valid'], kind='trial' if trial['valid'] else 'expired', message=trial['message'])
            if result['valid'] and 'kind' not in result:
                result['kind'] = 'paid'
            return result

    def activate(self, key):
        with self.lock:
            if not self.public_path.is_file(): raise ValueError('İstehsalçının açıq imza açarı quraşdırılmayıb.')
            now = int(time.time())
            # Activation must not reset the rollback guard from an existing installation.
            saved_path=self.root/'license.json'
            if saved_path.exists():
                saved=json.loads(saved_path.read_text(encoding='utf-8'))
                if saved.get('lastSeen',0)>now+300: raise ValueError('Kompüterin tarixini düzəldin.')
            if isinstance(key,str) and key.strip().startswith('RADAZ-ACT-'):
                key=self.billing_call('/v1/activate',dict(code=key.strip(),deviceId=self.device)).get('key')
            verify_key(key,json.loads(self.public_path.read_text()),self.device,now)
            atomic_json(saved_path,dict(key=key.strip(),lastSeen=now))
            return self.status()

    def billing_call(self, path, body=None, token=None):
        base=self.config.get('billingUrl','').rstrip('/')
        url=urlsplit(base)
        if not base: raise ValueError('Ödəniş xidməti hələ qoşulmayıb. Satıcı hesabı açıldıqdan sonra aktiv olacaq.')
        if url.username or url.password or url.query or url.fragment or (url.scheme!='https' and not (url.scheme=='http' and url.hostname in ('localhost','127.0.0.1'))):
            raise ValueError('Lisenziya serverinin HTTPS ünvanı düzgün deyil.')
        headers={'Accept':'application/json','Content-Type':'application/json'}
        if token: headers['Authorization']='Bearer '+token
        request=Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers=headers)
        try:
            with urlopen(request,timeout=20) as response: return json.loads(response.read(65536))
        except HTTPError as error:
            try: message=json.loads(error.read(65536)).get('error')
            except (ValueError,OSError): message=None
            raise ValueError(message or 'Ödəniş xidməti sorğunu qəbul etmədi.') from None
        except (URLError,OSError): raise ValueError('Ödəniş serverinə qoşulmaq mümkün olmadı. İnterneti yoxlayın.') from None

    def billing_catalog(self):
        if not self.config.get('billingUrl'): return dict(enabled=False,monthly=10,currency='AZN',maxMonths=120,message='Satıcı hesabı və ödəniş provayderi hələ qoşulmayıb.')
        return self.billing_call('/v1/catalog')

    def checkout(self, months):
        if type(months) is not int or not 1<=months<=120: raise ValueError('Ay sayı 1–120 olmalıdır.')
        with self.lock:
            result=self.billing_call('/v1/orders',dict(months=months))
            if not re.fullmatch(r'[a-f0-9-]{36}',result.get('id','')) or not re.fullmatch(r'[a-f0-9]{64}',result.get('token','')): raise ValueError('Sifariş cavabı düzgün deyil.')
            url=urlsplit(result.get('url',''))
            if url.scheme!='https' or url.username or url.password: raise ValueError('Ödəniş ünvanı düzgün deyil.')
            path=self.root/'orders.json';saved=json.loads(path.read_text()) if path.exists() else {}
            saved[result['id']]={'token':result['token'],'createdAt':int(time.time())};atomic_json(path,saved)
            return {k:v for k,v in result.items() if k!='token'}

    def order_status(self, identifier):
        if not re.fullmatch(r'[a-f0-9-]{36}',identifier): raise ValueError('Sifariş kodu düzgün deyil.')
        with self.lock:
            path=self.root/'orders.json';saved=json.loads(path.read_text()) if path.exists() else {}
            if identifier not in saved: raise ValueError('Bu kompüterdə sifariş tapılmadı.')
            return self.billing_call('/v1/orders/'+identifier,token=saved[identifier]['token'])

    def allowed(self):
        state = self.status()
        return not state['required'] or state['valid']

    def updates(self, force=False):
        with self.lock:
            now=time.time()
            ttl = 5 if force else 60 if self.cached_update and self.cached_update.get('state') in ('error','unpublished') else 900
            if self.cached_update and now-self.last_check < ttl: return self.cached_update
            repo=self.config.get('updateRepository') or self.config.get('repository','')
            if not re.fullmatch(r'[\w.-]+/[\w.-]+',repo): return dict(state='error',message='GitHub repozitoriyası ayarlanmayıb.')
            try:
                from radaz_desktop import get_latest_release
                release=get_latest_release(repo)
                version=str(release.get('tag_name','')).removeprefix('v')
                def parts(v):
                    match=re.fullmatch(r'(\d+)\.(\d+)\.(\d+)',v)
                    if not match: raise ValueError('Buraxılış versiyası semver (X.Y.Z) formatında deyil.')
                    return tuple(map(int,match.groups()))
                newer=parts(version)>parts(self.config['version'])
                self.cached_update=dict(state='available' if newer else 'current',message=f'Yeni versiya mövcuddur: {version}' if newer else 'Bu versiya aktualdır.',version=version)
                if newer: self.cached_update['url']=f'https://github.com/{repo}/releases/tag/{release["tag_name"]}'
            except HTTPError as error:
                self.cached_update=dict(state='unpublished' if error.code==404 else 'error',message='Repoya giriş yoxdur və ya hələ yayımlanmış buraxılış mövcud deyil.' if error.code==404 else f'GitHub yoxlaması alınmadı (HTTP {error.code}).')
            except (OSError, URLError, ValueError, KeyError):
                self.cached_update=dict(state='error',message='Yeniləmə yoxlanmadı. İnternet bağlantısını və repozitoriyanı yoxlayın.')
            self.last_check=now
            return self.cached_update
