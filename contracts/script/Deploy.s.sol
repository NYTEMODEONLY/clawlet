// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ClawletVault} from "../ClawletVault.sol";

/**
 * @title Deploy
 * @notice Deployment script for ClawletVault
 * @dev Run with: forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify
 */
contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying ClawletVault...");
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        ClawletVault vault = new ClawletVault();

        vm.stopBroadcast();

        console.log("ClawletVault deployed at:", address(vault));
        console.log("");
        console.log("Verify with:");
        console.log("forge verify-contract", address(vault), "ClawletVault");
    }
}

/**
 * @title DeployAndCreateVault
 * @notice Deploy and create initial vault in one transaction
 */
contract DeployAndCreateVault is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address agentAddress = vm.envAddress("AGENT_ADDRESS");
        uint256 dailyLimit = vm.envOr("DAILY_LIMIT", uint256(1 ether));
        uint256 perTxLimit = vm.envOr("PER_TX_LIMIT", uint256(0.1 ether));
        uint256 initialFunding = vm.envOr("INITIAL_FUNDING", uint256(0));

        console.log("Deploying ClawletVault and creating initial vault...");
        console.log("Agent:", agentAddress);
        console.log("Daily limit:", dailyLimit);
        console.log("Per-tx limit:", perTxLimit);
        console.log("Initial funding:", initialFunding);

        vm.startBroadcast(deployerPrivateKey);

        ClawletVault vault = new ClawletVault();
        console.log("ClawletVault deployed at:", address(vault));

        uint256 vaultId = vault.createVault{value: initialFunding}(
            agentAddress,
            dailyLimit,
            perTxLimit
        );
        console.log("Vault created with ID:", vaultId);

        vm.stopBroadcast();
    }
}
