// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Arc PayProof
/// @notice One-time invoices settled in Arc's native USDC.
contract ArcPayProof {
    enum Status {
        None,
        Open,
        Paid
    }

    struct Invoice {
        address payable payee;
        uint256 amount;
        bytes32 descriptionHash;
        Status status;
        address payer;
        uint64 paidBlock;
    }

    error ZeroAmount();
    error InvoiceNotFound(uint256 invoiceId);
    error InvoiceNotOpen(uint256 invoiceId);
    error IncorrectPaymentAmount(uint256 expected, uint256 received);
    error PayoutFailed(uint256 invoiceId);

    event InvoiceCreated(
        uint256 indexed invoiceId,
        address indexed payee,
        uint256 amount,
        bytes32 descriptionHash
    );
    event InvoicePaid(
        uint256 indexed invoiceId,
        address indexed payer,
        address indexed payee,
        uint256 amount
    );

    uint256 public nextInvoiceId = 1;
    mapping(uint256 => Invoice) private invoices;

    function createInvoice(uint256 amount, bytes32 descriptionHash) external returns (uint256 invoiceId) {
        if (amount == 0) revert ZeroAmount();

        invoiceId = nextInvoiceId++;
        invoices[invoiceId] = Invoice({
            payee: payable(msg.sender),
            amount: amount,
            descriptionHash: descriptionHash,
            status: Status.Open,
            payer: address(0),
            paidBlock: 0
        });

        emit InvoiceCreated(invoiceId, msg.sender, amount, descriptionHash);
    }

    function payInvoice(uint256 invoiceId) external payable {
        Invoice storage invoice = invoices[invoiceId];
        if (invoice.status == Status.None) revert InvoiceNotFound(invoiceId);
        if (invoice.status != Status.Open) revert InvoiceNotOpen(invoiceId);
        if (msg.value != invoice.amount) revert IncorrectPaymentAmount(invoice.amount, msg.value);

        invoice.status = Status.Paid;
        invoice.payer = msg.sender;
        invoice.paidBlock = uint64(block.number);

        (bool paid, ) = invoice.payee.call{value: msg.value}("");
        if (!paid) revert PayoutFailed(invoiceId);

        emit InvoicePaid(invoiceId, msg.sender, invoice.payee, msg.value);
    }

    function getInvoice(uint256 invoiceId) external view returns (Invoice memory invoice) {
        invoice = invoices[invoiceId];
        if (invoice.status == Status.None) revert InvoiceNotFound(invoiceId);
    }
}
