const fs=require('fs');
const {Document,Packer,Paragraph,TextRun,AlignmentType,PageBreak,Table,TableRow,TableCell,WidthType,BorderStyle,ShadingType}=require('docx');
const P=JSON.parse(fs.readFileSync('/tmp/claude-0/ped/val/final.json','utf8'));
const n=v=>Math.round(v).toLocaleString('de-DE');
const n2=v=>n(v)+',00';
const FONT='Times New Roman';
const p=(runs,opt={})=>new Paragraph({alignment:opt.align||AlignmentType.JUSTIFIED,spacing:{after:opt.after??160,line:opt.line||300},indent:opt.indent,children:(Array.isArray(runs)?runs:[runs]).map(r=>typeof r==='string'?new TextRun({text:r,font:FONT,size:24}):r)});
const b=t=>new TextRun({text:t,font:FONT,size:24,bold:true});
const t=t_=>new TextRun({text:t_,font:FONT,size:24});
const ph=t_=>new TextRun({text:t_,font:FONT,size:24,highlight:'yellow'});
const juzgado=c=>c==='Los Vilos'?[b('S.J.L. DE LETRAS Y GARANTÍA DE LOS VILOS')]:[ph('S.J.L. EN LO CIVIL CON COMPETENCIA EN LA COMUNA DE PETORCA [CONFIRMAR TRIBUNAL]')];
const ubic=c=>({'Los Vilos':'comuna de Los Vilos, provincia de Choapa, Región de Coquimbo','Petorca':'comuna de Petorca, provincia de Petorca, Región de Valparaíso','Illapel':'comuna de Illapel, provincia de Choapa, Región de Coquimbo','La Ligua':'comuna de La Ligua, provincia de Petorca, Región de Valparaíso'})[c];
const JZ={'Los Vilos':'S.J.L. DE LETRAS Y GARANTÍA DE LOS VILOS','Petorca':'S.J.L. DE LETRAS Y GARANTÍA DE PETORCA','Illapel':'S.J.L. DE LETRAS DE ILLAPEL'};
const DAT=x=>x.frame==='wgs'?'Datum WGS84 (SIRGAS-Chile), Huso 19 Sur.':'Datum Provisorio Sudamericano La Canoa de 1956, Elipsoide Internacional de 1924, Huso 19.';
const cell=(txt,w,bold,fill)=>new TableCell({width:{size:w,type:WidthType.DXA},shading:fill?{fill,type:ShadingType.CLEAR,color:'auto'}:undefined,margins:{top:40,bottom:40,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:String(txt),font:'Arial',size:16,bold})]})]});
const SOLO=process.argv[2];

for(const x of P.filter(z=>z.nombre===SOLO)){const children=[];
 children.push(p([b('EN LO PRINCIPAL: '),t(`Solicita concesión minera de exploración denominada "${x.nombre}". `),b('PRIMER OTROSÍ: '),t('Acompaña documentos. '),b('SEGUNDO OTROSÍ: '),t('Personería. '),b('TERCER OTROSÍ: '),t('Forma de notificación.')],{align:AlignmentType.LEFT,after:360}));
 children.push(p([b(JZ[x.comuna])],{align:AlignmentType.LEFT,after:360}));
 children.push(p([b('ÁLVARO CUMORA OLIVA HERRERA'),t(', chileno, '),t('divorciado'),t(', ingeniero civil industrial, cédula nacional de identidad N° 19.141.778-K, en representación, según se acreditará, de '),b('VALLE ESCONDIDO SpA'),t(' (nombre de fantasía '),b('MINERA VALLE ESCONDIDO SpA'),t('), sociedad por acciones, Rol Único Tributario N° 78.524.757-4, ambos domiciliados para estos efectos en calle Cerro El Plomo N° 5420, oficina 906, comuna de Las Condes, Región Metropolitana, a US. respetuosamente digo:')],{indent:{firstLine:1440}}));
 children.push(p([t(`Que, de conformidad con lo dispuesto en los artículos 28, 34, 43 y siguientes del Código de Minería, vengo en solicitar se constituya a favor de mi representada una concesión minera de exploración sobre terrenos ubicados en la ${ubic(x.comuna)}${x.otra_comuna?`, extendiéndose parte de su superficie a la ${ubic(x.otra_comuna)}`:''}, conforme a las siguientes menciones:`)],{indent:{firstLine:1440}}));
 const items=[
  [b('Nombre de la concesión: '),t(`"${x.nombre}".`)],
  [b('Punto medio de la cara superior: '),t(`coordenadas U.T.M. Norte ${n2(x.pm_N)} metros y Este ${n2(x.pm_E)} metros, ${DAT(x)}`)],
  [b('Superficie de la cara superior: '),t(`${n(x.ha)} hectáreas.`)],
  [b('Forma y lados: '),t(`paralelogramo de ángulos rectos, cuyos dos lados de orientación Norte-Sur U.T.M. miden ${n(x.NS)} metros cada uno y cuyos dos lados de orientación Este-Oeste U.T.M. miden ${n(x.EW)} metros cada uno.`)],
  [b('Vértices (referenciales, mismo datum y huso): '),t(`NW Norte ${n2(x.N1)} / Este ${n2(x.E0)}; NE Norte ${n2(x.N1)} / Este ${n2(x.E1)}; SE Norte ${n2(x.N0)} / Este ${n2(x.E1)}; SW Norte ${n2(x.N0)} / Este ${n2(x.E0)}.`)]];
 items.forEach((r,i)=>children.push(p([t(`${i+1}. `),...r],{indent:{left:720}})));
 children.push(p([b('POR TANTO, '),t('en mérito de lo expuesto y de las disposiciones legales citadas,')],{indent:{firstLine:1440}}));
 children.push(p([b('RUEGO A US. '),t(`tener por presentado el pedimento de la concesión minera de exploración "${x.nombre}", ordenar su inscripción y publicación conforme a la ley, y darle la tramitación que corresponda hasta dictar sentencia constitutiva a favor de mi representada.`)],{indent:{firstLine:1440}}));
 children.push(p([b('PRIMER OTROSÍ: '),t('Ruego a US. tener por acompañados, con citación, los siguientes documentos de Valle Escondido SpA, emitidos por el Registro de Empresas y Sociedades: (a) certificado de estatuto actualizado; (b) certificado de vigencia; y (c) certificado de anotaciones.')]));
 children.push(p([b('SEGUNDO OTROSÍ: '),t('Ruego a US. tener presente que mi personería para representar a Valle Escondido SpA, en calidad de gerente general, consta en los documentos acompañados en el primer otrosí.')]));
 children.push(p([b('TERCER OTROSÍ: '),t('Ruego a US. disponer que las resoluciones que se dicten en esta causa me sean notificadas al correo electrónico '),t('aoliva@ligniumenergy.com'),t('.')],{after:360}));
 children.push(p(t('______________________________'),{align:AlignmentType.CENTER,after:0}));
 children.push(p(b('ÁLVARO CUMORA OLIVA HERRERA'),{align:AlignmentType.CENTER,after:0}));
 children.push(p(t('p.p. Valle Escondido SpA (Minera Valle Escondido SpA)'),{align:AlignmentType.CENTER}));
const doc=new Document({styles:{default:{document:{run:{font:FONT,size:24}}}},sections:[{properties:{page:{size:{width:12240,height:18720},margin:{top:1700,bottom:1400,left:2000,right:1400}}},children}]});
Packer.toBuffer(doc).then(buf=>{fs.mkdirSync(x.dir,{recursive:true});fs.writeFileSync(`${x.dir}/${String(x.n).padStart(2,'0')}_${x.nombre.replaceAll(' ','_')}.docx`,buf);console.log('ok')});
}
