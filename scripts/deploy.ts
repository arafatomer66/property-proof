import { ethers, artifacts } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const factory = await ethers.getContractFactory("PropertyProof");
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("PropertyProof deployed to:", address);

  // Write address + ABI into the Angular app for easy consumption.
  const artifact = await artifacts.readArtifact("PropertyProof");
  const out = {
    address,
    abi: artifact.abi,
    chainId: 31337,
    network: "localhost",
  };

  const outDir = path.join(__dirname, "..", "frontend", "src", "assets");
  if (fs.existsSync(path.join(__dirname, "..", "frontend"))) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "PropertyProof.json"), JSON.stringify(out, null, 2));
    console.log("Wrote contract metadata to frontend/src/assets/PropertyProof.json");
  } else {
    console.log("(frontend/ not found yet — skipped writing ABI to Angular assets)");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
