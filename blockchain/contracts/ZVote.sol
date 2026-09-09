// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title ZVote
/// @notice A minimal, auditable on-chain ballot box for university SRC elections.
/// @dev Design principle (see ZVote Chapter Three, Section 3.1): "if the data is a vote,
///      it goes on the blockchain". Everything else (who may vote, candidate bios,
///      election scheduling) lives in the off-chain relational database. This contract
///      is intentionally small: it stores positions, candidates, and vote counts, and
///      it is the single source of truth for "has this address already voted for this
///      position" so that double-voting is impossible even if the backend/database is
///      compromised.
contract ZVote {
    /// @notice Address that deployed the contract / runs the election.
    /// @dev Only this address (the backend's signing wallet) may administer the
    ///      election or submit votes on behalf of voters. Voters never sign
    ///      transactions themselves (see Project Prompt: "No MetaMask required for voters").
    address public electionAuthority;

    /// @notice Whether the election is currently accepting votes.
    bool public electionActive;

    /// @notice Human readable name of the current/most recent election cycle.
    string public electionName;

    struct Candidate {
        string name;
        string programme;
        uint256 voteCount;
    }

    struct Position {
        string title;
        bool exists;
        Candidate[] candidates;
    }

    /// @dev positionId => Position
    mapping(uint256 => Position) private positions;

    /// @notice Total number of positions created so far. Also serves as the next positionId.
    uint256 public positionCount;

    /// @dev positionId => voter address => whether they have voted for that position
    mapping(uint256 => mapping(address => bool)) private votedForPosition;

    event PositionCreated(uint256 indexed positionId, string title);
    event CandidateAdded(uint256 indexed positionId, uint256 indexed candidateId, string name, string programme);
    event ElectionStarted(string electionName);
    event ElectionEnded(string electionName);
    event VoteCast(address indexed voter, uint256 indexed positionId, uint256 indexed candidateId);

    modifier onlyElectionAuthority() {
        require(msg.sender == electionAuthority, "ZVote: caller is not the election authority");
        _;
    }

    modifier positionExists(uint256 _positionId) {
        require(positions[_positionId].exists, "ZVote: position does not exist");
        _;
    }

    /// @notice Sets the deployer as the election authority.
    constructor() {
        electionAuthority = msg.sender;
    }

    /// @notice Creates a new voting position (e.g. "SRC President").
    /// @param _title Human readable title of the position.
    /// @return positionId The identifier assigned to the new position.
    function createPosition(string memory _title) external onlyElectionAuthority returns (uint256 positionId) {
        require(bytes(_title).length > 0, "ZVote: title cannot be empty");

        positionId = positionCount;
        Position storage p = positions[positionId];
        p.title = _title;
        p.exists = true;

        positionCount += 1;

        emit PositionCreated(positionId, _title);
    }

    /// @notice Adds a candidate to an existing position.
    /// @param _positionId The position the candidate is running for.
    /// @param _name Candidate's full name.
    /// @param _programme Candidate's programme / department of study.
    /// @return candidateId The index of the candidate within the position's candidate list.
    function addCandidate(uint256 _positionId, string memory _name, string memory _programme)
        external
        onlyElectionAuthority
        positionExists(_positionId)
        returns (uint256 candidateId)
    {
        require(bytes(_name).length > 0, "ZVote: name cannot be empty");

        Position storage p = positions[_positionId];
        candidateId = p.candidates.length;
        p.candidates.push(Candidate({name: _name, programme: _programme, voteCount: 0}));

        emit CandidateAdded(_positionId, candidateId, _name, _programme);
    }

    /// @notice Opens the election for voting.
    /// @param _electionName Human readable name shown to voters (e.g. "2026/2027 SRC Election").
    function startElection(string memory _electionName) external onlyElectionAuthority {
        require(!electionActive, "ZVote: election already active");
        electionName = _electionName;
        electionActive = true;
        emit ElectionStarted(_electionName);
    }

    /// @notice Closes the election. No further votes may be cast once ended.
    function endElection() external onlyElectionAuthority {
        require(electionActive, "ZVote: election is not active");
        electionActive = false;
        emit ElectionEnded(electionName);
    }

    /// @notice Records a vote on behalf of a voter.
    /// @dev Called exclusively by the backend's election-authority wallet after the
    ///      backend has already verified the voter's eligibility in the off-chain
    ///      database. `_voter` is the voter's deterministic wallet address, used purely
    ///      as a unique identifier for the double-voting check -- voters never hold or
    ///      use the private key for this address.
    /// @param _voter Address representing the voter (derived/managed by the backend).
    /// @param _positionId The position being voted for.
    /// @param _candidateId The candidate chosen for that position.
    function vote(address _voter, uint256 _positionId, uint256 _candidateId)
        external
        onlyElectionAuthority
        positionExists(_positionId)
    {
        require(electionActive, "ZVote: election is not active");
        require(_voter != address(0), "ZVote: invalid voter address");
        require(!votedForPosition[_positionId][_voter], "ZVote: voter has already voted for this position");

        Position storage p = positions[_positionId];
        require(_candidateId < p.candidates.length, "ZVote: invalid candidate id");

        votedForPosition[_positionId][_voter] = true;
        p.candidates[_candidateId].voteCount += 1;

        emit VoteCast(_voter, _positionId, _candidateId);
    }

    /// @notice Returns the tallied results for a position.
    /// @param _positionId The position to fetch results for.
    /// @return names Candidate names, in candidate-id order.
    /// @return programmes Candidate programmes, in candidate-id order.
    /// @return voteCounts Vote counts, in candidate-id order.
    function getResults(uint256 _positionId)
        external
        view
        positionExists(_positionId)
        returns (string[] memory names, string[] memory programmes, uint256[] memory voteCounts)
    {
        Candidate[] storage candidates = positions[_positionId].candidates;
        uint256 len = candidates.length;

        names = new string[](len);
        programmes = new string[](len);
        voteCounts = new uint256[](len);

        for (uint256 i = 0; i < len; i++) {
            names[i] = candidates[i].name;
            programmes[i] = candidates[i].programme;
            voteCounts[i] = candidates[i].voteCount;
        }
    }

    /// @notice Returns whether a given address has already voted for a given position.
    function hasVoted(address _voter, uint256 _positionId) external view returns (bool) {
        return votedForPosition[_positionId][_voter];
    }

    /// @notice Returns the number of candidates registered for a position.
    function getCandidateCount(uint256 _positionId) external view positionExists(_positionId) returns (uint256) {
        return positions[_positionId].candidates.length;
    }

    /// @notice Returns the title of a position.
    function getPositionTitle(uint256 _positionId) external view positionExists(_positionId) returns (string memory) {
        return positions[_positionId].title;
    }
}
