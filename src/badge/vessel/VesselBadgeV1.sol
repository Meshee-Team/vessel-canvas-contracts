// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import {Attestation} from "@eas/contracts/IEAS.sol";

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {ScrollBadge} from "../ScrollBadge.sol";
import {ScrollBadgeAccessControl} from "../extensions/ScrollBadgeAccessControl.sol";
import {ScrollBadgeNoExpiry} from "../extensions/ScrollBadgeNoExpiry.sol";
import {ScrollBadgeNonRevocable} from "../extensions/ScrollBadgeNonRevocable.sol";
import {ScrollBadgeSingleton} from "../extensions/ScrollBadgeSingleton.sol";

/// @title VesselBadgeV1
/// @notice Scroll badge of Vessel protocol
contract VesselBadgeV1 is
    ScrollBadgeAccessControl,
    ScrollBadgeNoExpiry,
    ScrollBadgeNonRevocable,
    ScrollBadgeSingleton
{
    /// @notice The base token URI.
    string public badgeURI;

    constructor(address resolver_, string memory badgeURI_) ScrollBadge(resolver_) {
        badgeURI = badgeURI_;
    }

    /// @notice Update the badgeURI.
    /// @param badgeURI_ The new base token URI.
    function updateBadgeURI(string memory badgeURI_) external onlyOwner {
        badgeURI = badgeURI_;
    }

    /// @inheritdoc ScrollBadge
    function onIssueBadge(Attestation calldata attestation)
        internal
        override (
            ScrollBadgeAccessControl,
            ScrollBadgeNoExpiry,
            ScrollBadgeNonRevocable,
            ScrollBadgeSingleton
        )
        returns (bool)
    {
        return super.onIssueBadge(attestation);
    }

    /// @inheritdoc ScrollBadge
    function onRevokeBadge(Attestation calldata attestation)
        internal
        override (
            ScrollBadge, ScrollBadgeAccessControl, ScrollBadgeNoExpiry, ScrollBadgeSingleton
        )
        returns (bool)
    {
        return super.onRevokeBadge(attestation);
    }

    /// @inheritdoc ScrollBadge
    function badgeTokenURI(bytes32 /*uid*/) public view override returns (string memory) {
        return badgeURI;
    }
}
