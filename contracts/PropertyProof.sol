// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PropertyProof — append-only registry of property document hashes
/// @notice Single super-admin (the registrar) can register, amend, and transfer
///         properties. The contract stores the real-world owner of each property
///         as metadata; only the registrar can mutate state. Anyone can read.
contract PropertyProof {
    struct Revision {
        bytes32 docHash;
        address owner;
        uint64  timestamp;
        string  note;
    }

    address public superAdmin;
    mapping(string => Revision[]) private revisions;
    mapping(string => address)    public  currentOwner;

    event PropertyRegistered(string indexed propertyId, bytes32 docHash, address owner);
    event PropertyAmended(string indexed propertyId, bytes32 docHash, address owner, uint256 revisionIndex);
    event OwnershipTransferred(string indexed propertyId, address indexed from, address indexed to);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);

    modifier onlyAdmin() {
        require(msg.sender == superAdmin, "not super admin");
        _;
    }

    constructor() {
        superAdmin = msg.sender;
        emit AdminTransferred(address(0), msg.sender);
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "newAdmin required");
        require(newAdmin != superAdmin, "already admin");
        address previous = superAdmin;
        superAdmin = newAdmin;
        emit AdminTransferred(previous, newAdmin);
    }

    function registerProperty(
        string calldata propertyId,
        bytes32 docHash,
        string calldata note,
        address recordedOwner
    ) external onlyAdmin {
        require(bytes(propertyId).length > 0, "propertyId required");
        require(docHash != bytes32(0), "docHash required");
        require(recordedOwner != address(0), "recordedOwner required");
        require(currentOwner[propertyId] == address(0), "already registered");

        revisions[propertyId].push(Revision({
            docHash: docHash,
            owner: recordedOwner,
            timestamp: uint64(block.timestamp),
            note: note
        }));
        currentOwner[propertyId] = recordedOwner;

        emit PropertyRegistered(propertyId, docHash, recordedOwner);
    }

    function amendProperty(
        string calldata propertyId,
        bytes32 newDocHash,
        string calldata note
    ) external onlyAdmin {
        require(newDocHash != bytes32(0), "docHash required");
        require(currentOwner[propertyId] != address(0), "property not registered");

        address recordedOwner = currentOwner[propertyId];
        revisions[propertyId].push(Revision({
            docHash: newDocHash,
            owner: recordedOwner,
            timestamp: uint64(block.timestamp),
            note: note
        }));

        emit PropertyAmended(propertyId, newDocHash, recordedOwner, revisions[propertyId].length - 1);
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

    function getHistory(string calldata propertyId) external view returns (Revision[] memory) {
        return revisions[propertyId];
    }

    function revisionCount(string calldata propertyId) external view returns (uint256) {
        return revisions[propertyId].length;
    }

    /// @notice Verify whether a hash corresponds to a known revision of a property.
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
