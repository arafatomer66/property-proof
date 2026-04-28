// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PropertyProof v2 — append-only land registry with multi-role workflow
/// @notice Super-admin (registrar) is the source of truth. Authorized lawyers
///         can submit pending registrations/amendments that the admin must
///         approve before they become canonical revisions. Anyone can read.
contract PropertyProof {
    enum SubmissionKind { REGISTER, AMEND }
    enum SubmissionStatus { PENDING, APPROVED, REJECTED }

    struct Revision {
        bytes32 docHash;
        address recordedOwner;
        uint64  timestamp;
        string  note;
        address submitter;
        string  fileURL;
    }

    struct PendingSubmission {
        SubmissionKind   kind;
        string           propertyId;
        bytes32          docHash;
        string           note;
        address          recordedOwner;
        string           fileURL;
        address          submittedBy;
        uint64           submittedAt;
        SubmissionStatus status;
        string           rejectReason;
    }

    address public superAdmin;

    mapping(address => bool)        public  isLawyer;
    mapping(string => Revision[])   private revisions;
    mapping(string => address)      public  currentOwner;
    PendingSubmission[]             private pending;

    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
    event LawyerGranted(address indexed lawyer);
    event LawyerRevoked(address indexed lawyer);

    event SubmissionFiled(uint256 indexed id, SubmissionKind kind, address indexed submittedBy, string propertyId);
    event SubmissionApproved(uint256 indexed id);
    event SubmissionRejected(uint256 indexed id, string reason);

    event PropertyRegistered(string indexed propertyId, bytes32 docHash, address recordedOwner, address submitter);
    event PropertyAmended(string indexed propertyId, bytes32 docHash, uint256 revisionIndex, address submitter);
    event OwnershipTransferred(string indexed propertyId, address indexed from, address indexed to);

    modifier onlyAdmin() {
        require(msg.sender == superAdmin, "not super admin");
        _;
    }

    modifier onlyLawyer() {
        require(isLawyer[msg.sender], "not authorized lawyer");
        _;
    }

    constructor() {
        superAdmin = msg.sender;
        emit AdminTransferred(address(0), msg.sender);
    }

    // ---------------------------------------------------------------
    // Admin role management
    // ---------------------------------------------------------------

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "newAdmin required");
        require(newAdmin != superAdmin, "already admin");
        address previous = superAdmin;
        superAdmin = newAdmin;
        emit AdminTransferred(previous, newAdmin);
    }

    function grantLawyerRole(address lawyer) external onlyAdmin {
        require(lawyer != address(0), "lawyer required");
        require(!isLawyer[lawyer], "already lawyer");
        isLawyer[lawyer] = true;
        emit LawyerGranted(lawyer);
    }

    function revokeLawyerRole(address lawyer) external onlyAdmin {
        require(isLawyer[lawyer], "not a lawyer");
        isLawyer[lawyer] = false;
        emit LawyerRevoked(lawyer);
    }

    // ---------------------------------------------------------------
    // Admin direct writes
    // ---------------------------------------------------------------

    function registerProperty(
        string calldata propertyId,
        bytes32 docHash,
        string calldata note,
        address recordedOwner,
        string calldata fileURL
    ) external onlyAdmin {
        _writeRegistration(propertyId, docHash, note, recordedOwner, fileURL, msg.sender);
    }

    function amendProperty(
        string calldata propertyId,
        bytes32 newDocHash,
        string calldata note,
        string calldata fileURL
    ) external onlyAdmin {
        _writeAmendment(propertyId, newDocHash, note, fileURL, msg.sender);
    }

    function transferOwnership(
        string calldata propertyId,
        address newOwner
    ) external onlyAdmin {
        require(currentOwner[propertyId] != address(0), "property not registered");
        require(newOwner != address(0), "newOwner required");
        address previous = currentOwner[propertyId];
        require(newOwner != previous, "already owner");

        currentOwner[propertyId] = newOwner;
        emit OwnershipTransferred(propertyId, previous, newOwner);
    }

    // ---------------------------------------------------------------
    // Lawyer submissions
    // ---------------------------------------------------------------

    function submitRegistration(
        string calldata propertyId,
        bytes32 docHash,
        string calldata note,
        address recordedOwner,
        string calldata fileURL
    ) external onlyLawyer returns (uint256 id) {
        require(bytes(propertyId).length > 0, "propertyId required");
        require(docHash != bytes32(0), "docHash required");
        require(recordedOwner != address(0), "recordedOwner required");

        id = pending.length;
        pending.push(PendingSubmission({
            kind: SubmissionKind.REGISTER,
            propertyId: propertyId,
            docHash: docHash,
            note: note,
            recordedOwner: recordedOwner,
            fileURL: fileURL,
            submittedBy: msg.sender,
            submittedAt: uint64(block.timestamp),
            status: SubmissionStatus.PENDING,
            rejectReason: ""
        }));

        emit SubmissionFiled(id, SubmissionKind.REGISTER, msg.sender, propertyId);
    }

    function submitAmendment(
        string calldata propertyId,
        bytes32 docHash,
        string calldata note,
        string calldata fileURL
    ) external onlyLawyer returns (uint256 id) {
        require(docHash != bytes32(0), "docHash required");
        require(currentOwner[propertyId] != address(0), "property not registered");

        id = pending.length;
        pending.push(PendingSubmission({
            kind: SubmissionKind.AMEND,
            propertyId: propertyId,
            docHash: docHash,
            note: note,
            recordedOwner: address(0),
            fileURL: fileURL,
            submittedBy: msg.sender,
            submittedAt: uint64(block.timestamp),
            status: SubmissionStatus.PENDING,
            rejectReason: ""
        }));

        emit SubmissionFiled(id, SubmissionKind.AMEND, msg.sender, propertyId);
    }

    // ---------------------------------------------------------------
    // Admin approval
    // ---------------------------------------------------------------

    function approvePending(uint256 id) external onlyAdmin {
        require(id < pending.length, "invalid id");
        PendingSubmission storage p = pending[id];
        require(p.status == SubmissionStatus.PENDING, "not pending");

        if (p.kind == SubmissionKind.REGISTER) {
            _writeRegistration(p.propertyId, p.docHash, p.note, p.recordedOwner, p.fileURL, p.submittedBy);
        } else {
            _writeAmendment(p.propertyId, p.docHash, p.note, p.fileURL, p.submittedBy);
        }

        p.status = SubmissionStatus.APPROVED;
        emit SubmissionApproved(id);
    }

    function rejectPending(uint256 id, string calldata reason) external onlyAdmin {
        require(id < pending.length, "invalid id");
        PendingSubmission storage p = pending[id];
        require(p.status == SubmissionStatus.PENDING, "not pending");

        p.status = SubmissionStatus.REJECTED;
        p.rejectReason = reason;
        emit SubmissionRejected(id, reason);
    }

    // ---------------------------------------------------------------
    // Internal write helpers (used by both admin-direct and approval paths)
    // ---------------------------------------------------------------

    function _writeRegistration(
        string memory propertyId,
        bytes32 docHash,
        string memory note,
        address recordedOwner,
        string memory fileURL,
        address submitter
    ) internal {
        require(bytes(propertyId).length > 0, "propertyId required");
        require(docHash != bytes32(0), "docHash required");
        require(recordedOwner != address(0), "recordedOwner required");
        require(currentOwner[propertyId] == address(0), "already registered");

        revisions[propertyId].push(Revision({
            docHash: docHash,
            recordedOwner: recordedOwner,
            timestamp: uint64(block.timestamp),
            note: note,
            submitter: submitter,
            fileURL: fileURL
        }));
        currentOwner[propertyId] = recordedOwner;

        emit PropertyRegistered(propertyId, docHash, recordedOwner, submitter);
    }

    function _writeAmendment(
        string memory propertyId,
        bytes32 docHash,
        string memory note,
        string memory fileURL,
        address submitter
    ) internal {
        require(docHash != bytes32(0), "docHash required");
        require(currentOwner[propertyId] != address(0), "property not registered");

        address recordedOwner = currentOwner[propertyId];
        revisions[propertyId].push(Revision({
            docHash: docHash,
            recordedOwner: recordedOwner,
            timestamp: uint64(block.timestamp),
            note: note,
            submitter: submitter,
            fileURL: fileURL
        }));

        emit PropertyAmended(propertyId, docHash, revisions[propertyId].length - 1, submitter);
    }

    // ---------------------------------------------------------------
    // Public reads
    // ---------------------------------------------------------------

    function getHistory(string calldata propertyId) external view returns (Revision[] memory) {
        return revisions[propertyId];
    }

    function revisionCount(string calldata propertyId) external view returns (uint256) {
        return revisions[propertyId].length;
    }

    function getPendingSubmissions() external view returns (PendingSubmission[] memory) {
        return pending;
    }

    function pendingCount() external view returns (uint256) {
        return pending.length;
    }

    function getPending(uint256 id) external view returns (PendingSubmission memory) {
        require(id < pending.length, "invalid id");
        return pending[id];
    }

    function verify(string calldata propertyId, bytes32 docHash) external view returns (
        bool exists,
        bool isCurrent,
        uint256 revisionIndex
    ) {
        Revision[] storage chain = revisions[propertyId];
        for (uint256 i = 0; i < chain.length; i++) {
            if (chain[i].docHash == docHash) {
                return (true, i == chain.length - 1, i);
            }
        }
        return (false, false, 0);
    }
}
