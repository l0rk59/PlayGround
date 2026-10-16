import fs from "fs";
import path from "path";

const SECRET_FILE = path.join(process.cwd(), "usine-secrets.local.json");

export type Secrets = {
  [key: string]: string | undefined;
};

export function lireSecrets(): Secrets {
  try {
    return JSON.parse(fs.readFileSync(SECRET_FILE, "utf8"));
  } catch {
    return {};
  }
}

export function ecrireSecrets(secrets: Secrets): void {
  const courant = lireSecrets();
  const fusion = { ...courant, ...secrets };
  for (const k of Object.keys(fusion)) {
    if (fusion[k] === undefined || fusion[k] === "") delete fusion[k];
  }
  fs.writeFileSync(SECRET_FILE, JSON.stringify(fusion, null, 2), { mode: 0o600 });
}
