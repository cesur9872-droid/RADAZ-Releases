export type TableSort = {key:string;direction:'asc'|'desc'};
export type SortValue = string|number|null|undefined;
const collator = new Intl.Collator('az',{numeric:true,sensitivity:'base'});
export function sortRows<T>(rows:readonly T[],sort:TableSort,values:Record<string,(row:T)=>SortValue>):T[]{
 const value=values[sort.key];if(!value)return [...rows];
 return rows.map((row,index)=>({row,index,value:value(row)})).sort((a,b)=>{
  const emptyA=a.value==null||a.value==='',emptyB=b.value==null||b.value==='';
  if(emptyA!==emptyB)return emptyA?1:-1;
  const compared=typeof a.value==='number'&&typeof b.value==='number'?a.value-b.value:collator.compare(String(a.value??''),String(b.value??''));
  return compared*(sort.direction==='asc'?1:-1)||a.index-b.index;
 }).map(item=>item.row);
}
