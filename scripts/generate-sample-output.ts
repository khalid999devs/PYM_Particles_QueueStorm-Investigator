import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { analyzeTicket } from "../src/modules/analyze-ticket/analyze.service";
import { analyzeTicketRequestSchema } from "../src/modules/analyze-ticket/analyze.schema";

const sampleCaseSchema = z.object({
  id: z.string(),
  input: analyzeTicketRequestSchema
});

const sampleCasesSchema = z.array(sampleCaseSchema);

const main = async (): Promise<void> => {
  const samplesDir = join(process.cwd(), "samples");
  const samplePath = join(samplesDir, "public-sample-cases.json");
  const outputPath = join(samplesDir, "sample-output.json");
  const sampleCases = sampleCasesSchema.parse(JSON.parse(readFileSync(samplePath, "utf8")) as unknown);
  const firstSample = sampleCases[0];

  if (!firstSample) {
    throw new Error("No public sample cases found");
  }

  const output = await analyzeTicket(firstSample.input, { useAi: false });

  mkdirSync(samplesDir, { recursive: true });
  writeFileSync(
    outputPath,
    `${JSON.stringify(
      {
        sample_case_id: firstSample.id,
        input: firstSample.input,
        output,
        generated_at: new Date().toISOString()
      },
      null,
      2
    )}\n`
  );

  console.log(`Generated ${outputPath}`);
};

void main();
