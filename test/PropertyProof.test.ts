import { expect } from "chai";
import { ethers } from "hardhat";
import { PropertyProof } from "../typechain-types";

const HASH_A = ethers.sha256(ethers.toUtf8Bytes("deed-v1"));
const HASH_B = ethers.sha256(ethers.toUtf8Bytes("deed-v2"));
const HASH_C = ethers.sha256(ethers.toUtf8Bytes("deed-v3"));
const PID = "PLOT-001";
const URL_A = "http://localhost:4500/api/files/a.pdf";
const URL_B = "http://localhost:4500/api/files/b.pdf";

describe("PropertyProof v2", () => {
  async function deploy() {
    const [admin, owner1, owner2, lawyer1, lawyer2, stranger] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("PropertyProof");
    const contract = (await factory.deploy()) as PropertyProof;
    await contract.waitForDeployment();
    return { contract, admin, owner1, owner2, lawyer1, lawyer2, stranger };
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
  });

  describe("lawyer role", () => {
    it("admin can grant lawyer role and emit event", async () => {
      const { contract, lawyer1 } = await deploy();
      await expect(contract.grantLawyerRole(lawyer1.address))
        .to.emit(contract, "LawyerGranted")
        .withArgs(lawyer1.address);
      expect(await contract.isLawyer(lawyer1.address)).to.equal(true);
    });

    it("admin can revoke lawyer role and emit event", async () => {
      const { contract, lawyer1 } = await deploy();
      await contract.grantLawyerRole(lawyer1.address);
      await expect(contract.revokeLawyerRole(lawyer1.address))
        .to.emit(contract, "LawyerRevoked")
        .withArgs(lawyer1.address);
      expect(await contract.isLawyer(lawyer1.address)).to.equal(false);
    });

    it("non-admin cannot grant or revoke lawyer roles", async () => {
      const { contract, stranger, lawyer1 } = await deploy();
      await expect(contract.connect(stranger).grantLawyerRole(lawyer1.address)).to.be.revertedWith("not super admin");
      await contract.grantLawyerRole(lawyer1.address);
      await expect(contract.connect(stranger).revokeLawyerRole(lawyer1.address)).to.be.revertedWith("not super admin");
    });

    it("rejects granting an already-lawyer or revoking a non-lawyer", async () => {
      const { contract, lawyer1 } = await deploy();
      await contract.grantLawyerRole(lawyer1.address);
      await expect(contract.grantLawyerRole(lawyer1.address)).to.be.revertedWith("already lawyer");
      const { contract: c2, lawyer2 } = await deploy();
      await expect(c2.revokeLawyerRole(lawyer2.address)).to.be.revertedWith("not a lawyer");
    });
  });

  describe("registerProperty (admin direct)", () => {
    it("admin registers a property; revision records submitter and fileURL", async () => {
      const { contract, admin, owner1 } = await deploy();
      await expect(contract.registerProperty(PID, HASH_A, "Original deed", owner1.address, URL_A))
        .to.emit(contract, "PropertyRegistered")
        .withArgs(PID, HASH_A, owner1.address, admin.address);

      expect(await contract.currentOwner(PID)).to.equal(owner1.address);
      const history = await contract.getHistory(PID);
      expect(history.length).to.equal(1);
      expect(history[0].recordedOwner).to.equal(owner1.address);
      expect(history[0].docHash).to.equal(HASH_A);
      expect(history[0].submitter).to.equal(admin.address);
      expect(history[0].fileURL).to.equal(URL_A);
    });

    it("non-admin cannot register", async () => {
      const { contract, owner1, stranger } = await deploy();
      await expect(
        contract.connect(stranger).registerProperty(PID, HASH_A, "x", owner1.address, URL_A)
      ).to.be.revertedWith("not super admin");
    });

    it("reverts on duplicate, empty id, zero hash, or zero owner", async () => {
      const { contract, owner1 } = await deploy();
      await expect(contract.registerProperty("", HASH_A, "x", owner1.address, URL_A)).to.be.revertedWith("propertyId required");
      await expect(contract.registerProperty(PID, ethers.ZeroHash, "x", owner1.address, URL_A)).to.be.revertedWith("docHash required");
      await expect(contract.registerProperty(PID, HASH_A, "x", ethers.ZeroAddress, URL_A)).to.be.revertedWith("recordedOwner required");
      await contract.registerProperty(PID, HASH_A, "first", owner1.address, URL_A);
      await expect(contract.registerProperty(PID, HASH_B, "dup", owner1.address, URL_A)).to.be.revertedWith("already registered");
    });
  });

  describe("amendProperty (admin direct)", () => {
    it("admin amends, revision records submitter and fileURL", async () => {
      const { contract, admin, owner1 } = await deploy();
      await contract.registerProperty(PID, HASH_A, "v1", owner1.address, URL_A);
      await expect(contract.amendProperty(PID, HASH_B, "v2", URL_B))
        .to.emit(contract, "PropertyAmended")
        .withArgs(PID, HASH_B, 1n, admin.address);

      const history = await contract.getHistory(PID);
      expect(history[1].recordedOwner).to.equal(owner1.address);
      expect(history[1].docHash).to.equal(HASH_B);
      expect(history[1].submitter).to.equal(admin.address);
      expect(history[1].fileURL).to.equal(URL_B);
    });

    it("non-admin cannot amend directly", async () => {
      const { contract, owner1, stranger } = await deploy();
      await contract.registerProperty(PID, HASH_A, "v1", owner1.address, URL_A);
      await expect(contract.connect(stranger).amendProperty(PID, HASH_B, "v2", URL_B)).to.be.revertedWith("not super admin");
    });

    it("reverts when property is not registered", async () => {
      const { contract } = await deploy();
      await expect(contract.amendProperty(PID, HASH_B, "v2", URL_B)).to.be.revertedWith("property not registered");
    });
  });

  describe("transferOwnership (admin-only)", () => {
    it("admin transfers and emits event", async () => {
      const { contract, owner1, owner2 } = await deploy();
      await contract.registerProperty(PID, HASH_A, "v1", owner1.address, URL_A);
      await expect(contract.transferOwnership(PID, owner2.address))
        .to.emit(contract, "OwnershipTransferred")
        .withArgs(PID, owner1.address, owner2.address);
      expect(await contract.currentOwner(PID)).to.equal(owner2.address);
    });

    it("non-admin cannot transfer", async () => {
      const { contract, owner1, owner2, stranger } = await deploy();
      await contract.registerProperty(PID, HASH_A, "v1", owner1.address, URL_A);
      await expect(contract.connect(stranger).transferOwnership(PID, owner2.address)).to.be.revertedWith("not super admin");
    });
  });

  describe("lawyer submissions", () => {
    it("lawyer can submit a registration; admin approves; revision is written", async () => {
      const { contract, lawyer1, owner1 } = await deploy();
      await contract.grantLawyerRole(lawyer1.address);

      const tx = contract.connect(lawyer1).submitRegistration(PID, HASH_A, "lawyer-submitted", owner1.address, URL_A);
      await expect(tx)
        .to.emit(contract, "SubmissionFiled")
        .withArgs(0, 0, lawyer1.address, PID);

      // Property is NOT yet registered
      expect(await contract.currentOwner(PID)).to.equal(ethers.ZeroAddress);

      // Admin approves
      await expect(contract.approvePending(0))
        .to.emit(contract, "SubmissionApproved").withArgs(0)
        .and.to.emit(contract, "PropertyRegistered").withArgs(PID, HASH_A, owner1.address, lawyer1.address);

      const history = await contract.getHistory(PID);
      expect(history.length).to.equal(1);
      expect(history[0].submitter).to.equal(lawyer1.address);
      expect(history[0].fileURL).to.equal(URL_A);
    });

    it("lawyer can submit an amendment; admin approves", async () => {
      const { contract, admin, lawyer1, owner1 } = await deploy();
      await contract.grantLawyerRole(lawyer1.address);
      await contract.registerProperty(PID, HASH_A, "v1", owner1.address, URL_A);

      await contract.connect(lawyer1).submitAmendment(PID, HASH_B, "v2 by lawyer", URL_B);
      await expect(contract.approvePending(0))
        .to.emit(contract, "PropertyAmended");

      const history = await contract.getHistory(PID);
      expect(history.length).to.equal(2);
      expect(history[1].submitter).to.equal(lawyer1.address);
    });

    it("non-lawyer cannot submit", async () => {
      const { contract, stranger, owner1 } = await deploy();
      await expect(
        contract.connect(stranger).submitRegistration(PID, HASH_A, "x", owner1.address, URL_A)
      ).to.be.revertedWith("not authorized lawyer");
      await expect(
        contract.connect(stranger).submitAmendment(PID, HASH_A, "x", URL_A)
      ).to.be.revertedWith("not authorized lawyer");
    });

    it("revoked lawyer can no longer submit", async () => {
      const { contract, lawyer1, owner1 } = await deploy();
      await contract.grantLawyerRole(lawyer1.address);
      await contract.revokeLawyerRole(lawyer1.address);
      await expect(
        contract.connect(lawyer1).submitRegistration(PID, HASH_A, "x", owner1.address, URL_A)
      ).to.be.revertedWith("not authorized lawyer");
    });

    it("non-admin cannot approve or reject", async () => {
      const { contract, lawyer1, owner1, stranger } = await deploy();
      await contract.grantLawyerRole(lawyer1.address);
      await contract.connect(lawyer1).submitRegistration(PID, HASH_A, "x", owner1.address, URL_A);
      await expect(contract.connect(stranger).approvePending(0)).to.be.revertedWith("not super admin");
      await expect(contract.connect(stranger).rejectPending(0, "no")).to.be.revertedWith("not super admin");
    });

    it("admin can reject; rejection does not write a revision", async () => {
      const { contract, lawyer1, owner1 } = await deploy();
      await contract.grantLawyerRole(lawyer1.address);
      await contract.connect(lawyer1).submitRegistration(PID, HASH_A, "x", owner1.address, URL_A);

      await expect(contract.rejectPending(0, "wrong jurisdiction"))
        .to.emit(contract, "SubmissionRejected").withArgs(0, "wrong jurisdiction");

      expect(await contract.currentOwner(PID)).to.equal(ethers.ZeroAddress);
      const p = await contract.getPending(0);
      expect(p.status).to.equal(2); // REJECTED
      expect(p.rejectReason).to.equal("wrong jurisdiction");
    });

    it("cannot approve or reject an already-resolved submission", async () => {
      const { contract, lawyer1, owner1 } = await deploy();
      await contract.grantLawyerRole(lawyer1.address);
      await contract.connect(lawyer1).submitRegistration(PID, HASH_A, "x", owner1.address, URL_A);
      await contract.approvePending(0);
      await expect(contract.approvePending(0)).to.be.revertedWith("not pending");
      await expect(contract.rejectPending(0, "late")).to.be.revertedWith("not pending");
    });

    it("getPendingSubmissions returns the full queue", async () => {
      const { contract, lawyer1, owner1 } = await deploy();
      await contract.grantLawyerRole(lawyer1.address);
      await contract.connect(lawyer1).submitRegistration("A", HASH_A, "n1", owner1.address, URL_A);
      await contract.connect(lawyer1).submitRegistration("B", HASH_B, "n2", owner1.address, URL_B);
      const all = await contract.getPendingSubmissions();
      expect(all.length).to.equal(2);
      expect(all[0].propertyId).to.equal("A");
      expect(all[1].propertyId).to.equal("B");
    });
  });

  describe("verify (public read)", () => {
    it("returns (false, false, 0) for unknown property", async () => {
      const { contract } = await deploy();
      const r = await contract.verify(PID, HASH_A);
      expect(r.exists).to.equal(false);
    });

    it("flags current revision as exists+isCurrent and older as outdated", async () => {
      const { contract, owner1 } = await deploy();
      await contract.registerProperty(PID, HASH_A, "v1", owner1.address, URL_A);
      await contract.amendProperty(PID, HASH_B, "v2", URL_B);

      const old = await contract.verify(PID, HASH_A);
      expect(old.exists).to.equal(true); expect(old.isCurrent).to.equal(false);
      const cur = await contract.verify(PID, HASH_B);
      expect(cur.exists).to.equal(true); expect(cur.isCurrent).to.equal(true);
    });

    it("returns false for a tampered hash", async () => {
      const { contract, owner1 } = await deploy();
      await contract.registerProperty(PID, HASH_A, "v1", owner1.address, URL_A);
      const tampered = ethers.sha256(ethers.toUtf8Bytes("deed-v1-tampered"));
      const r = await contract.verify(PID, tampered);
      expect(r.exists).to.equal(false);
    });

    it("verify is callable by anyone", async () => {
      const { contract, owner1, stranger } = await deploy();
      await contract.registerProperty(PID, HASH_A, "v1", owner1.address, URL_A);
      const r = await contract.connect(stranger).verify(PID, HASH_A);
      expect(r.exists).to.equal(true);
    });
  });

  describe("getHistory ordering", () => {
    it("returns revisions in append order with the recorded owner of the time", async () => {
      const { contract, owner1, owner2 } = await deploy();
      await contract.registerProperty(PID, HASH_A, "first", owner1.address, URL_A);
      await contract.amendProperty(PID, HASH_B, "second", URL_B);
      await contract.transferOwnership(PID, owner2.address);
      await contract.amendProperty(PID, HASH_C, "third", URL_A);

      const history = await contract.getHistory(PID);
      expect(history.length).to.equal(3);
      expect(history[0].recordedOwner).to.equal(owner1.address);
      expect(history[1].recordedOwner).to.equal(owner1.address);
      expect(history[2].recordedOwner).to.equal(owner2.address);
    });
  });
});
