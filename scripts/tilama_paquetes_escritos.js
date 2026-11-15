const fs=require('fs');const {Document,Packer,Paragraph,TextRun,AlignmentType,Table,TableRow,TableCell,WidthType,BorderStyle}=require('docx');
const D=JSON.parse(fs.readFileSync('esc.json','utf8'));
const t=(s,o={})=>new TextRun({text:s,font:'Arial',size:22,...o});const b=s=>t(s,{bold:true});
const p=(runs,o={})=>new Paragraph({children:Array.isArray(runs)?runs:[runs],spacing:{after:o.after??160,line:340},alignment:o.align??AlignmentType.JUSTIFIED,indent:o.indent});
const f2=v=>v.toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:2});
const bd={style:BorderStyle.SINGLE,size:1,color:'888888'};const B={top:bd,bottom:bd,left:bd,right:bd};
const cell=(s,w,bo=false)=>new TableCell({borders:B,width:{size:w,type:WidthType.DXA},margins:{top:60,bottom:60,left:100,right:100},children:[new Paragraph({children:[t(s,{bold:bo,size:20})]})]});
const tbl=(rows,ws)=>new Table({width:{size:ws.reduce((a,c)=>a+c,0),type:WidthType.DXA},columnWidths:ws,rows:rows.map((r,i)=>new TableRow({children:r.map((c,j)=>cell(c,ws[j],i===0))}))});
const ind={firstLine:1134};
const comp=[p([b('ÁLVARO CUMORA OLIVA HERRERA'),t(', chileno, divorciado, ingeniero civil industrial, cédula nacional de identidad N° 19.141.778-K, en representación de '),b('VALLE ESCONDIDO SpA'),t(', Rol Único Tributario N° 78.524.757-4, ambos domiciliados para estos efectos en calle Cerro El Plomo N° 5420, oficina 906, comuna de Las Condes, Región Metropolitana, en autos ')])];
const firma=[p(t('______________________________'),{align:AlignmentType.CENTER,after:0}),p(b('ÁLVARO CUMORA OLIVA HERRERA'),{align:AlignmentType.CENTER,after:0}),p(t('p.p. Valle Escondido SpA'),{align:AlignmentType.CENTER})];
const vt=x=>tbl([['Vértice','Norte (m)','Este (m)'],['V1 (NW)',f2(x.V[0][1]),f2(x.V[0][0])],['V2 (NE)',f2(x.V[1][1]),f2(x.V[1][0])],['V3 (SE)',f2(x.V[2][1]),f2(x.V[2][0])],['V4 (SW)',f2(x.V[3][1]),f2(x.V[3][0])]],[2200,3300,3300]);
const datum='Datum Provisorio Sudamericano La Canoa de 1956, Elipsoide Internacional de 1924, Huso 19';
const jobs=[];
for(const [rol,x] of Object.entries(D)){
 let outp;const fn=x.nombre.replace(' ','_');let C;
 if(x.tipo==='ped'){
  C=[p([b('EN LO PRINCIPAL: '),t('Solicita sentencia constitutiva. '),b('PRIMER OTROSÍ: '),t('Acompaña documentos. '),b('SEGUNDO OTROSÍ: '),t('Forma de notificación.')]),
  p(b('S.J.L. DE LETRAS Y GARANTÍA DE LOS VILOS'),{align:AlignmentType.LEFT,after:200}),p(b(`Causa rol ${rol}`),{align:AlignmentType.LEFT,after:200}),
  p([...comp[0].root?[]:[],b('ÁLVARO CUMORA OLIVA HERRERA'),t(', chileno, divorciado, ingeniero civil industrial, cédula nacional de identidad N° 19.141.778-K, en representación de '),b('VALLE ESCONDIDO SpA'),t(', Rol Único Tributario N° 78.524.757-4, ambos domiciliados para estos efectos en calle Cerro El Plomo N° 5420, oficina 906, comuna de Las Condes, Región Metropolitana, en autos sobre pedimento de concesión minera de exploración '),b(`"${x.nombre}"`),t(', a US. respetuosamente digo:')],{indent:ind}),
  p([t('Que, dentro del plazo de noventa días contado desde la resolución que ordenó inscribir y publicar el pedimento, y de conformidad con el artículo 55 del Código de Minería, vengo en solicitar se dicte sentencia constitutiva de la concesión minera de exploración '),b(`"${x.nombre}"`),t(` sobre la totalidad del terreno pedido, de ${x.ha} hectáreas, cuya cara superior es un rectángulo de ${x.NS.toLocaleString('es-CL')} metros en sus lados Norte-Sur y ${x.EW.toLocaleString('es-CL')} metros en sus lados Este-Oeste, con las siguientes coordenadas U.T.M. de sus vértices, ${datum}:`)],{indent:ind}),
  vt(x),p(t(''),{after:120}),
  p([t(`El vértice V1 (NW) se encuentra a ${f2(x.dist)} metros del punto medio señalado en el pedimento (Norte ${f2(x.pm[1])} metros y Este ${f2(x.pm[0])} metros), según rumbo ${x.rumbo} (azimut ${x.az.toLocaleString('es-CL')}°).`)],{indent:ind}),
  p([b('POR TANTO, '),t(`RUEGO A US. tener por formulada la solicitud y, previo informe del Servicio Nacional de Geología y Minería, dictar sentencia constitutiva de la concesión minera de exploración "${x.nombre}" a favor de Valle Escondido SpA.`)],{indent:ind}),
  p([b('PRIMER OTROSÍ: '),t('Ruego a US. tener por acompañados, con citación: (1) comprobante de pago de la tasa de pedimento; (2) comprobante de pago de la patente proporcional del artículo 144 del Código de Minería; (3) copia autorizada de la inscripción del pedimento a fojas ____, número ____, del Registro de Descubrimientos del Conservador de Minas de ____________, año 2026; (4) ejemplar del Boletín Oficial de Minería N° ______, de fecha ____ de __________ de 202_, en que se publicó dicha inscripción; y (5) plano de la concesión con la configuración y las coordenadas de sus vértices, firmado por el profesional que lo elaboró.')]),
  p([b('SEGUNDO OTROSÍ: '),t('Ruego a US. disponer que las resoluciones que se dicten en esta causa me sean notificadas al correo electrónico aoliva@ligniumenergy.com.')],{after:700}),...firma];
  outp=`${x.dir}solicitud_sentencia_${fn}.docx`;
 } else {
  const rows=[['N°','Norte inferior','Norte superior','Este oeste','Este este','ha']].concat(x.pert.map(q=>[String(q.n),f2(q.N0),f2(q.N1),f2(q.E0),f2(q.E1),String(q.ha)]));
  C=[p([b('EN LO PRINCIPAL: '),t('Solicita mensura. '),b('PRIMER OTROSÍ: '),t('Acompaña documentos. '),b('SEGUNDO OTROSÍ: '),t('Forma de notificación.')]),
  p(b('S.J.L. DE LETRAS Y GARANTÍA DE LOS VILOS'),{align:AlignmentType.LEFT,after:200}),p(b(`Causa rol ${rol}`),{align:AlignmentType.LEFT,after:200}),
  p([b('ÁLVARO CUMORA OLIVA HERRERA'),t(', chileno, divorciado, ingeniero civil industrial, cédula nacional de identidad N° 19.141.778-K, en representación de '),b('VALLE ESCONDIDO SpA'),t(', Rol Único Tributario N° 78.524.757-4, ambos domiciliados para estos efectos en calle Cerro El Plomo N° 5420, oficina 906, comuna de Las Condes, Región Metropolitana, en autos sobre manifestación minera '),b(`"${x.nombre}, 1 AL ${x.ha}"`),t(', a US. respetuosamente digo:')],{indent:ind}),
  p([t('Que, dentro del plazo legal y de conformidad con los artículos 59 y siguientes del Código de Minería, vengo en solicitar la mensura de la manifestación '),b(`"${x.nombre}, 1 AL ${x.ha}"`),t(`, cuyo punto de interés se encuentra en las coordenadas U.T.M. Norte ${f2(x.pm[1])} metros y Este ${f2(x.pm[0])} metros, ${datum}, comprendiendo ${x.pert.length} pertenencias con una superficie total de ${x.pert.reduce((a,q)=>a+q.ha,0)} hectáreas, todas dentro del terreno manifestado, con las siguientes coordenadas:`)],{indent:ind}),
  tbl(rows,[700,1800,1800,1800,1800,700]),p(t(''),{after:120}),
  p([t('Para la práctica de la mensura propongo al ingeniero o perito mensurador don(ña) ______________________________, RUT ____________, inscrito(a) en el registro respectivo, y solicito se fije el día ____ de __________ de 202_ para el inicio de las operaciones.')],{indent:ind}),
  p([b('POR TANTO, '),t('RUEGO A US. tener por solicitada la mensura, ordenar su publicación y designar al perito propuesto.')],{indent:ind}),
  p([b('PRIMER OTROSÍ: '),t('Ruego a US. tener por acompañados, con citación: (1) comprobante de pago de la tasa de la manifestación; (2) copia autorizada de la inscripción de la manifestación a fojas ____, número ____, del Registro de Descubrimientos del Conservador de Minas de ____________; (3) ejemplar del Boletín Oficial de Minería N° ______ en que se publicó; y (4) plano de ubicación de las pertenencias a mensurar.')]),
  p([b('SEGUNDO OTROSÍ: '),t('Ruego a US. disponer que las resoluciones que se dicten en esta causa me sean notificadas al correo electrónico aoliva@ligniumenergy.com.')],{after:700}),...firma];
  outp=`${x.dir}solicitud_mensura_${fn}.docx`;
 }
 const doc=new Document({sections:[{properties:{page:{size:{width:12240,height:18720},margin:{top:1600,bottom:1300,left:1600,right:1300}}},children:C}]});
 const o=outp;jobs.push(Packer.toBuffer(doc).then(z=>fs.writeFileSync(o,z)));
}
Promise.all(jobs).then(()=>console.log('ok',jobs.length));
