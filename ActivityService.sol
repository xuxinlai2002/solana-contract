// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title ActivityService
 * @dev This contract manages activity payments and platform fees
 * It supports both ETH and ERC20 token payments
 * Implements role-based access control and reentrancy protection
 */
contract ActivityService is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using ECDSA for bytes32;
    
    address public constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    // Platform fee ratio in basis points (e.g., 1000 = 10%)
    uint256 public platformFeeRatio; // 1-10000

    // Project balances: project => token => ProjectBalance
    struct ProjectBalance {
        address tokenAddress;
        uint256 balance;
    }
    mapping(address => mapping(address => ProjectBalance)) public projectBalances;

    // EIP-712 type hashes
    bytes32 private constant CLAIM_TYPEHASH = keccak256(
        "Claim(address tokenAddress,uint256 amount,string activityId,uint256 timestamp)"
    );
    bytes32 private constant CLAIM_REWARD_TYPEHASH = keccak256(
        "ClaimReward(address tokenAddress,uint256[] amounts,string[] rewardIds,uint256 timestamp)"
    );
    bytes32 private constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    // Used signature records
    mapping(bytes32 => bool) public usedSignatures;

    // Claimed rewardId records (stored as hash to save storage)
    // Key format: keccak256(abi.encodePacked(userAddress, rewardId))
    mapping(bytes32 => bool) public claimedRewardIds;

    // Whitelist management
    mapping(address => bool) public whitelist;



    // Events
    event PlatformFeeRatioChanged(uint256 newRatio);
    event WhiteListUpdated(address[] addresses, bool status);
    event Deposit(address indexed project, address indexed token, uint256 amount, uint256 fee, string activityId);
    event Withdraw(address indexed project, address indexed to, address indexed token, uint256 amount);
    event BatchTransfer(address indexed project, address indexed token, address[] recipients, uint256[] amounts, string activityId);
    event ProjectBalanceChanged(address indexed project, address indexed token, uint256 newBalance);
    event ClaimByKol(address indexed kol, address indexed token, uint256 amount, string activityId);
    event ClaimByReward(address indexed user, address indexed token, uint256 totalAmount, string[] rewardIds);

    modifier onlyProject() {
        require(msg.sender != address(0), "Invalid project");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        platformFeeRatio = 0; // Default: no fee
    }

    /**
     * @dev User claims multiple rewards by signature (deduplicated by rewardId per user)
     * @param tokenAddress token address
     * @param amounts claim amount per rewardId
     * @param rewardIds reward ID list
     * @param timestamp timestamp
     * @param signature signature
     */
    function claimByReward(
        address tokenAddress,
        uint256[] calldata amounts,
        string[] calldata rewardIds,
        uint256 timestamp,
        bytes calldata signature
    ) external nonReentrant {
        require(rewardIds.length == amounts.length, "Array length mismatch");
        require(rewardIds.length > 0, "Empty params");

        bytes memory data = abi.encode(
            tokenAddress,
            amounts,
            rewardIds,
            timestamp
        );

        bytes32 signatureHash = keccak256(signature);
        require(!usedSignatures[signatureHash], "Signature already used");
        usedSignatures[signatureHash] = true;

        _verifySignature(CLAIM_REWARD_TYPEHASH, data, timestamp, signature);

        // Process only unclaimed rewards and accumulate total amount
        uint256 totalAmount = 0;
        string[] memory processedRewardIds = new string[](rewardIds.length);
        uint256 processedCount = 0;
        
        for (uint256 i = 0; i < rewardIds.length; i++) {
            // Create unique key combining user address and rewardId
            bytes32 userRewardKey = keccak256(abi.encodePacked(msg.sender, rewardIds[i]));
            
            // Only process if not already claimed by this user
            if (!claimedRewardIds[userRewardKey]) {
                claimedRewardIds[userRewardKey] = true;
                totalAmount += amounts[i];
                processedRewardIds[processedCount] = rewardIds[i];
                processedCount++;
            }
        }

        // Only transfer if there are unclaimed rewards
        if (totalAmount > 0) {
            // Transfer the total amount to msg.sender (one-time)
            if (tokenAddress == ETH_ADDRESS) {
                (bool success, ) = msg.sender.call{value: totalAmount}("");
                require(success, "ETH transfer failed");
            } else {
                IERC20(tokenAddress).transfer(msg.sender, totalAmount);
            }

            // Resize array to actual processed count
            string[] memory finalProcessedRewardIds = new string[](processedCount);
            for (uint256 i = 0; i < processedCount; i++) {
                finalProcessedRewardIds[i] = processedRewardIds[i];
            }

            emit ClaimByReward(msg.sender, tokenAddress, totalAmount, finalProcessedRewardIds);
        }
    }

    /**
     * @dev Verify EIP-712 signature
     * @param typeHash type hash
     * @param data encoded data
     * @param timestamp timestamp
     * @param signature signature
     * @return signer address
     */
    function _verifySignature(
        bytes32 typeHash,
        bytes memory data,
        uint256 timestamp,
        bytes calldata signature
    ) internal view returns (address) {
        require(block.timestamp <= timestamp + 1 hours, "Signature expired");
        
        bytes32 structHash;
        if (typeHash == CLAIM_TYPEHASH) {
            // Decode claim data
            (
                address tokenAddress,
                uint256 amount,
                string memory activityId,
                uint256 _timestamp
            ) = abi.decode(data, (address, uint256, string, uint256));

            structHash = keccak256(abi.encode(
                typeHash,
                tokenAddress,
                amount,
                keccak256(bytes(activityId)),
                _timestamp
            ));
        } else if (typeHash == CLAIM_REWARD_TYPEHASH) {
            // Decode claimReward data
            (
                address tokenAddress,
                uint256[] memory amounts,
                string[] memory rewardIds,
                uint256 _timestamp
            ) = abi.decode(data, (address, uint256[], string[], uint256));

            // Hash arrays in EIP-712 style
            bytes32 amountsHash = keccak256(abi.encodePacked(amounts));
            bytes32[] memory rewardIdHashes = new bytes32[](rewardIds.length);
            for (uint256 i = 0; i < rewardIds.length; i++) {
                rewardIdHashes[i] = keccak256(bytes(rewardIds[i]));
            }
            bytes32 rewardIdsHash = keccak256(abi.encodePacked(rewardIdHashes));

            structHash = keccak256(abi.encode(
                typeHash,
                tokenAddress,
                amountsHash,
                rewardIdsHash,
                _timestamp
            ));
        } else {
            revert("Invalid type hash");
        }

        bytes32 domainSeparator = keccak256(abi.encode(
            DOMAIN_TYPEHASH,
            keccak256(bytes("ActivityService")),
            keccak256(bytes("1")),
            block.chainid,
            address(this)
        ));

        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            domainSeparator,
            structHash
        ));

        address signer = digest.recover(signature);
        require(whitelist[signer], "Signer not in whitelist");
        return signer;
    }




    /**
     * @dev Check if a specific user has claimed a specific rewardId
     * @param user User address
     * @param rewardId Reward ID string
     * @return userRewardKey The computed key for the user-reward combination
     * @return isClaimed Whether the reward has been claimed by the user
     */
    function checkRewardClaimStatus(address user, string calldata rewardId) 
        external 
        view 
        returns (bytes32 userRewardKey, bool isClaimed) 
    {
        userRewardKey = keccak256(abi.encodePacked(user, rewardId));
        isClaimed = claimedRewardIds[userRewardKey];
    }

    // UUPS upgrade authorization
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // Receive ETH
    receive() external payable {}
} 