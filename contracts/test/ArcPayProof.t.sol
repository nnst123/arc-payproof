// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/ArcPayProof.sol";

interface Vm {
    function deal(address account, uint256 balance) external;
    function prank(address sender) external;
    function expectRevert(bytes4 selector) external;
    function expectRevert(bytes calldata revertData) external;
}

contract RejectingPayee {
    ArcPayProof private immutable app;

    constructor(ArcPayProof app_) {
        app = app_;
    }

    function createInvoice(uint256 amount, bytes32 descriptionHash) external returns (uint256) {
        return app.createInvoice(amount, descriptionHash);
    }

    receive() external payable {
        revert("cannot receive USDC");
    }
}

contract ArcPayProofTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    ArcPayProof private app;
    address private constant buyer = address(0xB0B);
    uint256 private constant amount = 1e16; // 0.01 native USDC
    bytes32 private constant descriptionHash = keccak256("Demo invoice");

    receive() external payable {}

    function setUp() public {
        app = new ArcPayProof();
        vm.deal(buyer, 10e18);
    }

    function testCreateAndPay() public {
        uint256 invoiceId = app.createInvoice(amount, descriptionHash);
        require(invoiceId == 1, "wrong invoice ID");

        ArcPayProof.Invoice memory beforePayment = app.getInvoice(invoiceId);
        require(beforePayment.payee == address(this), "wrong payee");
        require(beforePayment.amount == amount, "wrong amount");
        require(beforePayment.descriptionHash == descriptionHash, "wrong description hash");
        require(beforePayment.status == ArcPayProof.Status.Open, "not open");

        uint256 balanceBefore = address(this).balance;
        vm.prank(buyer);
        app.payInvoice{value: amount}(invoiceId);

        ArcPayProof.Invoice memory afterPayment = app.getInvoice(invoiceId);
        require(afterPayment.status == ArcPayProof.Status.Paid, "not paid");
        require(afterPayment.payer == buyer, "wrong payer");
        require(afterPayment.paidBlock == block.number, "wrong payment block");
        require(address(this).balance == balanceBefore + amount, "wrong payout");
        require(address(app).balance == 0, "contract retained payment");
    }

    function testRejectsZeroAmount() public {
        vm.expectRevert(ArcPayProof.ZeroAmount.selector);
        app.createInvoice(0, descriptionHash);
    }

    function testRejectsUnknownInvoice() public {
        vm.expectRevert(abi.encodeWithSelector(ArcPayProof.InvoiceNotFound.selector, 42));
        app.getInvoice(42);

        vm.expectRevert(abi.encodeWithSelector(ArcPayProof.InvoiceNotFound.selector, 42));
        vm.prank(buyer);
        app.payInvoice{value: amount}(42);
    }

    function testRejectsWrongAmount() public {
        uint256 invoiceId = app.createInvoice(amount, descriptionHash);
        vm.expectRevert(abi.encodeWithSelector(ArcPayProof.IncorrectPaymentAmount.selector, amount, amount - 1));
        vm.prank(buyer);
        app.payInvoice{value: amount - 1}(invoiceId);

        require(app.getInvoice(invoiceId).status == ArcPayProof.Status.Open, "state changed");
    }

    function testRejectsDoublePayment() public {
        uint256 invoiceId = app.createInvoice(amount, descriptionHash);
        vm.prank(buyer);
        app.payInvoice{value: amount}(invoiceId);

        vm.expectRevert(abi.encodeWithSelector(ArcPayProof.InvoiceNotOpen.selector, invoiceId));
        vm.prank(buyer);
        app.payInvoice{value: amount}(invoiceId);
    }

    function testPayoutFailureRollsBack() public {
        RejectingPayee payee = new RejectingPayee(app);
        uint256 invoiceId = payee.createInvoice(amount, descriptionHash);

        vm.expectRevert(abi.encodeWithSelector(ArcPayProof.PayoutFailed.selector, invoiceId));
        vm.prank(buyer);
        app.payInvoice{value: amount}(invoiceId);

        ArcPayProof.Invoice memory invoice = app.getInvoice(invoiceId);
        require(invoice.status == ArcPayProof.Status.Open, "state changed");
        require(invoice.payer == address(0), "payer changed");
        require(invoice.paidBlock == 0, "payment block changed");
        require(address(app).balance == 0, "contract retained payment");
    }
}
