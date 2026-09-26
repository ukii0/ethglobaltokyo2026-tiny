// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice One personal garden per wallet. No deposits, token approvals or administrator.
contract TinySprout {
    bytes32 public constant APP_ID = keccak256("tiny-sprout-v1");
    struct Garden { uint64 plantedAt; uint8 pot; string name; uint32[] careDays; }
    mapping(address => Garden) private gardens;

    error AlreadyPlanted();
    error NotPlanted();
    error InvalidPot();
    error InvalidName();
    error AlreadyWatered();
    error InvalidPage();
    event SproutPlanted(address indexed owner, uint8 pot, string name, uint64 plantedAt);
    event SproutWatered(address indexed owner, uint32 day, uint256 totalCareDays);
    event SproutRenamed(address indexed owner, string name);

    function plant(uint8 pot, string calldata name) external {
        if (gardens[msg.sender].plantedAt != 0) revert AlreadyPlanted();
        if (pot > 2) revert InvalidPot();
        validateName(bytes(name));
        Garden storage garden = gardens[msg.sender];
        garden.plantedAt = uint64(block.timestamp);
        garden.pot = pot;
        garden.name = name;
        emit SproutPlanted(msg.sender, pot, name, garden.plantedAt);
    }

    function water() external {
        Garden storage garden = gardens[msg.sender];
        if (garden.plantedAt == 0) revert NotPlanted();
        uint32 today = uint32(block.timestamp / 1 days);
        uint256 count = garden.careDays.length;
        if (count > 0 && garden.careDays[count - 1] >= today) revert AlreadyWatered();
        garden.careDays.push(today);
        emit SproutWatered(msg.sender, today, count + 1);
    }

    function rename(string calldata name) external {
        if (gardens[msg.sender].plantedAt == 0) revert NotPlanted();
        validateName(bytes(name));
        gardens[msg.sender].name = name;
        emit SproutRenamed(msg.sender, name);
    }

    function getSprout(address owner) external view returns (uint64 plantedAt, uint8 pot, string memory name, uint256 totalCareDays) {
        Garden storage garden = gardens[owner];
        return (garden.plantedAt, garden.pot, garden.name, garden.careDays.length);
    }

    function getCareDays(address owner, uint256 offset, uint256 limit) external view returns (uint32[] memory days_) {
        if (limit == 0 || limit > 256) revert InvalidPage();
        uint32[] storage history = gardens[owner].careDays;
        uint256 count = offset >= history.length ? 0 : history.length - offset;
        if (count > limit) count = limit;
        days_ = new uint32[](count);
        for (uint256 i; i < count; ++i) days_[i] = history[offset + i];
    }

    /// @dev Accept 1–20 UTF-8 codepoints, excluding controls, overlong encodings and surrogates.
    function validateName(bytes memory value) private pure {
        if (value.length == 0 || value.length > 80) revert InvalidName();
        uint256 count;
        bool visible;
        for (uint256 i; i < value.length;) {
            uint8 a = uint8(value[i]);
            uint256 width;
            if (a < 0x80) {
                if (a < 0x20 || a == 0x7f) revert InvalidName();
                if (a != 0x20) visible = true;
                width = 1;
            } else {
                visible = true;
                if (a >= 0xc2 && a <= 0xdf) width = 2;
                else if (a >= 0xe0 && a <= 0xef) width = 3;
                else if (a >= 0xf0 && a <= 0xf4) width = 4;
                else revert InvalidName();
                if (i + width > value.length) revert InvalidName();
                uint8 b = uint8(value[i + 1]);
                if ((a == 0xe0 && b < 0xa0) || (a == 0xed && b >= 0xa0) || (a == 0xf0 && b < 0x90) || (a == 0xf4 && b >= 0x90)) revert InvalidName();
                for (uint256 j = 1; j < width; ++j) if (uint8(value[i + j]) < 0x80 || uint8(value[i + j]) > 0xbf) revert InvalidName();
            }
            i += width;
            if (++count > 20) revert InvalidName();
        }
        if (!visible) revert InvalidName();
    }
}
