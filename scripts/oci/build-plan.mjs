import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const multiArchPlatforms = Object.freeze(["linux/amd64", "linux/arm64"]);

function selectedPlatforms(platform) {
  if (platform === undefined) return multiArchPlatforms;
  const selected = required(platform, "platform");
  if (!multiArchPlatforms.includes(selected)) {
    throw new Error(`platform must be one of: ${multiArchPlatforms.join(", ")}`);
  }
  return Object.freeze([selected]);
}

function required(value, name) {
  if (typeof value !== "string" || !value || /[\0\r\n]/.test(value)) {
    throw new Error(`${name} must be a non-empty single-line value`);
  }
  return value;
}

function exactRevision(value, name) {
  const revision = required(value, name);
  if (!/^[a-f0-9]{40}$/.test(revision)) {
    throw new Error(`${name} must be an exact 40-character Git SHA`);
  }
  return revision;
}

export function createMultiArchBuildPlan({ image, sourceRevision, frameworkRef, appRef, output, platform }) {
  const imageRef = required(image, "image");
  const revision = exactRevision(sourceRevision, "sourceRevision");
  const frameworkRevision = exactRevision(frameworkRef, "frameworkRef");
  const appRevision = exactRevision(appRef, "appRef");
  const destination = path.resolve(required(output, "output"));
  const platforms = selectedPlatforms(platform);
  if (/:latest$/.test(imageRef)) throw new Error("image must not use the latest tag");
  return {
    schema: "one_person_lab_oci_multi_arch_build_plan.v1",
    status: "plan_only",
    platforms,
    image: imageRef,
    sourceRevision: revision,
    externalCohort: {
      frameworkRef: frameworkRevision,
      appRef: appRevision
    },
    output: destination,
    command: [
      "docker", "buildx", "build",
      "--platform", platforms.join(","),
      "--provenance=mode=max",
      "--sbom=true",
      "--output", `type=oci,dest=${destination}`,
      "--build-arg", `OPL_SOURCE_REVISION=${revision}`,
      "--build-arg", `OPL_FRAMEWORK_REF=${frameworkRevision}`,
      "--build-arg", `OPL_APP_REF=${appRevision}`,
      "--tag", imageRef,
      "."
    ],
    evidenceBoundary: {
      executesBuild: false,
      publishesImage: false,
      hostedArchitectureQualified: false,
      registryDigestKnown: false,
      signatureVerified: false
    }
  };
}

function parse(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!value) throw new Error(`Missing value for ${flag}`);
    if (flag === "--image") options.image = value;
    else if (flag === "--source-revision") options.sourceRevision = value;
    else if (flag === "--framework-ref") options.frameworkRef = value;
    else if (flag === "--app-ref") options.appRef = value;
    else if (flag === "--output") options.output = value;
    else if (flag === "--platform") options.platform = value;
    else throw new Error(`Unknown option: ${flag}`);
  }
  return options;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    process.stdout.write(`${JSON.stringify(createMultiArchBuildPlan(parse(process.argv.slice(2))), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ status: "oci_build_plan_failed", message: error.message }, null, 2)}\n`);
    process.exitCode = 1;
  }
}
