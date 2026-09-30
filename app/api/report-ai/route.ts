// Reporting now uses the user's ChatGPT composer. No API credentials or uploads are accepted here.
export const dynamic = 'force-dynamic';
export function GET() { return Response.json({configured:false,mode:'chatgpt',help:'/chatgpt-help'},{headers:{'Cache-Control':'no-store'}}); }
export function POST() { return Response.json({error:'API hesabatı söndürülüb. Hesabat səhifəsində ChatGPT-yə ötür funksiyasından istifadə edin.'},{status:410,headers:{'Cache-Control':'no-store'}}); }
