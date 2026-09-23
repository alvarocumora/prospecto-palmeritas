import { buildProjectDoc } from "../../src/lib/pdf/generateProjectDoc";
import { buildCholquiDoc } from "../../src/lib/pdf/adapters/cholqui";
import { writeFileSync } from "node:fs";

const model = buildCholquiDoc();
for (const kind of ["deck", "onepager", "technical"] as const) {
  const doc = await buildProjectDoc(model, kind);
  const ab = doc.output("arraybuffer");
  writeFileSync(`/tmp/pdfqa/${kind}.pdf`, Buffer.from(ab));
  console.log(kind, "ok");
}
