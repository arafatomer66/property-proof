import { expect } from "chai";
import { ethers } from "hardhat";
import { PropertyProof } from "../typechain-types";

const HASH_A = ethers.sha256(ethers.toUtf8Bytes("deed-v1"));
const HASH_B = ethers.sha256(ethers.toUtf8Bytes("deed-v2"));
const HASH_C = ethers.sha256(ethers.toUtf8Bytes("deed-v3"));
const PID = "PLOT-001";

describe("PropertyProof", () => {
  async function deploy() {
    const [admin, owner1, owner2, stranger] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("PropertyProof");
    const contract = (await factory.deploy()) as PropertyProof;
    await contract.waitForDeployment();
    return { contract, admin, owner1, owner2, stranger };
  }

  describe("admin role", () => {
    it("sets the deployer as the initial super admin", async () => {
      const { contract, admin } = await deploy();
      expect(await contract.superAdmin()).to.equal(admin.address);
    });

    it("admin can transfer admin to another address", async () => {
      const { contract, admin, owner1 } = await deploy();
      await expect(contract.transferAdmin(owner1.address))
        .to.emit(contract, "AdminTransferred")
        .withArgs(admin.address, owner1.address);
      expect(await contract.superAdmin()).to.equal(owner1.address);
    });

    it("non-admin cannot transferAdmin", async () => {
      const { contract, owner1, owner2 } = await deploy();
      await expect(contract.connect(owner1).transferAdmin(owner2.address)).to.be.revertedWith("not super admin");
    });

    it("rejects admin transfer to zero or to current admin", async () => {
      const { contract, admin } = await deploy();
      await expect(contract.transferAdmin(ethers.ZeroAddress)).to.be.revertedWith("newAdmin required");
      await expect(contract.transferAdmin(admin.address)).to.be.revertedWith("already admin");
    });
  });

  describe("registerProperty (admin-only)", () => {
    it("admin registers a property and records the recorded owner", async () => {
      const { contract, owner1 } = await deploy();
      await expect(contract.registerProperty(PID, HASH_A, "Original deed", owner1.address))
        .to.emit(contract, "PropertyRegistered")
        .withArgs(PID, HASH_A, owner1.address);

      expect(await contract.currentOwner(PID)).to.equal(owner1.address);
      const history = await contract.getHistory(PID);
      expect(history.length).to.equal(1);
      expect(history[0].owner).to.equal(owner1.address);
      expect(history[0].docHash).to.equal(HASH_A);
    });

    it("non-admin cannot register", async () => {
      const { contract, owner1, stranger } = await deploy();
      await expect(
        contract.connect(stranger).registerProperty(PID, HASH_A, "x", owner1.address)
      ).to.be.revertedWith("not super admin");
    });

    it("reverts on duplicate, empty id, zero hash, or zero owner", async () => {
      const { contract, owner1 } = await deploy();
      await expect(contract.registerProperty("", HASH_A, "x", owner1.address)).to.be.revertedWith("propertyId required");
      await expect(contract.registerProperty(PID, ethers.ZeroHash, "x", owner1.address)).to.be.revertedWith("docHash required");
      await expect(contract.registerProperty(PID, HASH_A, "x", ethers.ZeroAddress)).to.be.revertedWith("recordedOwner required");
      await contract.registerProperty(PID, HASH_A, "first", owner1.address);
      await expect(contract.registerProperty(PID, HASH_B, "dup", owner1.address)).to.be.revertedWith("already registered");
    });
  });

  describe("amendProperty (admin-only)", () => {
    it("admin amends and records owner from currentOwner mapping", async () => {
      const { contract, owner1 } = await deploy();
      await contract.registerProperty(PID, HASH_A, "v1", owner1.address);
      await expect(contract.amendProperty(PID, HASH_B, "v2"))
        .to.emit(contract, "PropertyAmended")
        .withArgs(PID, HASH_B, owner1.address, 1n);

      const history = await contract.getHistory(PID);
      expect(history[1].owner).to.equal(owner1.address);
      expect(history[1].docHash).to.equal(HASH_B);
    });

    it("non-admin cannot amend", async () => {
      const { contract, owner1, stranger } = await deploy();
      await contract.registerProperty(PID, HASH_A, "v1", owner1.address);
      await expect(contract.connect(stranger).amendProperty(PID, HASH_B, "v2")).to.be.revertedWith("not super admin");
      await expect(contract.connect(owner1).amendProperty(PID, HASH_B, "v2")).to.be.revertedWith("not super admin");
    });

    it("reverts when property is not registered", async () => {
      const { contract } = await deploy();
      await expect(contract.amendProperty(PID, HASH_B, "v2")).to.be.revertedWith("property not registered");
    });
  });

  describe("transferOwnership (admin-only)", () => {
    it("admin transfers and emits event", async () => {
      const { contract, owner1, owner2 } = await deploy();
      await contract.registerProperty(PID, HASH_A, "v1", owner1.address);
      await expect(contract.transferOwnership(PID, owner2.address))
        .to.emit(contract, "OwnershipTransferred")
        .withArgs(PID, owner1.address, owner2.address);
      expect(await contract.currentOwner(PID)).to.equal(owner2.address);
    });

    it("after transfer, future amendments record the new owner", async () => {
      const { contract, owner1, owner2 } = await deploy();
      await contract.registerProperty(PID, HASH_A, "v1", owner1.address);
      await contract.transferOwnership(PID, owner2.address);
      await contract.amendProperty(PID, HASH_B, "v2");
      const history = await contract.getHistory(PID);
      expect(history[1].owner).to.equal(owner2.address);
    });

    it("non-admin cannot transfer", async () => {
      const { contract, owner1, owner2, stranger } = await deploy();
      await contract.registerProperty(PID, HASH_A, "v1", owner1.address);
      await expect(contract.connect(stranger).transferOwnership(PID, owner2.address)).to.be.revertedWith("not super admin");
    });

    it("rejects unregistered property, zero address, and same-owner transfer", async () => {
      const { contract, owner1 } = await deploy();
      await expect(contract.transferOwnership(PID, owner1.address)).to.be.revertedWith("property not registered");
      await contract.registerProperty(PID, HASH_A, "v1", owner1.address);
      await expect(contract.transferOwnership(PID, ethers.ZeroAddress)).to.be.revertedWith("newOwner required");
      await expect(contract.transferOwnership(PID, owner1.address)).to.be.revertedWith("already owner");
    });
  });

  describe("verify (public read)", () => {
    it("returns (false, false, 0) for unknown property and unknown hash", async () => {
      const { contract } = await deploy();
      const r = await contract.verify(PID, HASH_A);
      expect(r.exists).to.equal(false);
      expect(r.isCurrent).to.equal(false);
      expect(r.revisionIndex).to.equal(0n);
    });

    it("flags current revision as exists+isCurrent and older revisions as outdated", async () => {
      const { contract, owner1 } = await deploy();
      await contract.registerProperty(PID, HASH_A, "v1", owner1.address);
      await contract.amendProperty(PID, HASH_B, "v2");
      await contract.amendProperty(PID, HASH_C, "v3");

      const old = await contract.verify(PID, HASH_A);
      expect(old.exists).to.equal(true); expect(old.isCurrent).to.equal(false); expect(old.revisionIndex).to.equal(0n);
      const cur = await contract.verify(PID, HASH_C);
      expect(cur.exists).to.equal(true); expect(cur.isCurrent).to.equal(true); expect(cur.revisionIndex).to.equal(2n);
    });

    it("returns false for a tampered hash", async () => {
      const { contract, owner1 } = await deploy();
      await contract.registerProperty(PID, HASH_A, "v1", owner1.address);
      const tampered = ethers.sha256(ethers.toUtf8Bytes("deed-v1-tampered"));
      const r = await contract.verify(PID, tampered);
      expect(r.exists).to.equal(false);
    });

    it("verify is callable by anyone, including non-admin", async () => {
      const { contract, owner1, stranger } = await deploy();
      await contract.registerProperty(PID, HASH_A, "v1", owner1.address);
      const r = await contract.connect(stranger).verify(PID, HASH_A);
      expect(r.exists).to.equal(true);
      expect(r.isCurrent).to.equal(true);
    });
  });

  describe("getHistory ordering", () => {
    it("returns revisions in append order with the recorded owner of the time", async () => {
      const { contract, owner1, owner2 } = await deploy();
      await contract.registerProperty(PID, HASH_A, "first", owner1.address);
      await contract.amendProperty(PID, HASH_B, "second");
      await contract.transferOwnership(PID, owner2.address);
      await contract.amendProperty(PID, HASH_C, "third");

      const history = await contract.getHistory(PID);
      expect(history.length).to.equal(3);
      expect(history[0].docHash).to.equal(HASH_A); expect(history[0].owner).to.equal(owner1.address);
      expect(history[1].docHash).to.equal(HASH_B); expect(history[1].owner).to.equal(owner1.address);
      expect(history[2].docHash).to.equal(HASH_C); expect(history[2].owner).to.equal(owner2.address);
    });
  });
});
