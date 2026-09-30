'use client';
import {useState} from 'react';
import {sortRows,type TableSort,type SortValue} from '@/lib/table-sort';
export function useTableSort<T>(rows:readonly T[],values:Record<string,(row:T)=>SortValue>,initial:TableSort){
 const [sort,setSort]=useState(initial);
 const change=(key:string)=>setSort(current=>({key,direction:current.key===key&&current.direction==='asc'?'desc':'asc'}));
 return {rows:sortRows(rows,sort,values),sort,change};
}
export function SortHeader({column,label,sort,change}:{column:string;label:string;sort:TableSort;change:(key:string)=>void}){
 const active=sort.key===column;
 return <th aria-sort={active?(sort.direction==='asc'?'ascending':'descending'):'none'}><button className="table-sort" onClick={()=>change(column)} aria-label={`${label} üzrə sırala`}>{label}<span aria-hidden="true">{active?(sort.direction==='asc'?'▲':'▼'):'↕'}</span></button></th>;
}
