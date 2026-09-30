export function licenseAccess(required:boolean,valid:boolean,path:string){
 const limited=required&&!valid;
 const open=['/','/archive','/pacs','/media','/chatgpt-help'].includes(path);
 return {limited,blocked:limited&&!open};
}
