export function RadazLogo({ size = 32 }: { size?: number }) {
  return <span className="radaz-logo" role="img" aria-label="RADAZ radiologiya loqosu" style={{width:size,height:size,fontSize:size*.59}}><span className="radaz-logo-ring" aria-hidden="true"/><span className="radaz-logo-letter" aria-hidden="true">R</span></span>;
}
