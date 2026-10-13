import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBillingTransition, validatePaymentMutation, validateProposalTransition } from './commercial-workflow.ts';

test('payments require bounded amounts and complete invoice/payment evidence', () => {
  assert.equal(validatePaymentMutation({ billingStatus: 'paid', amount: 100, paidAmount: 100, paidDate: '2026-10-13' }), null);
  assert.match(validatePaymentMutation({ billingStatus: 'paid', amount: 100, paidAmount: 99, paidDate: '2026-10-13' }) || '', /pembayaran penuh/);
  assert.match(validatePaymentMutation({ billingStatus: 'paid', amount: 100, paidAmount: 101, paidDate: '2026-10-13' }) || '', /antara Rp0/);
  assert.match(validatePaymentMutation({ billingStatus: 'paid', amount: 100, paidAmount: 100 }) || '', /tanggal bayar/);
  assert.match(validatePaymentMutation({ billingStatus: 'invoiced', amount: 100, paidAmount: 0 }) || '', /nomor/);
  assert.equal(validatePaymentMutation({ billingStatus: 'invoiced', amount: 100, paidAmount: 30, invoiceNumber: 'INV-1', invoiceDate: '2026-10-01', dueDate: '2026-10-13' }), null);
});

test('invoice payment transitions cannot reopen unissued or paid rows', () => {
  assert.equal(validateBillingTransition('unbilled', 'invoiced'), null);
  assert.match(validateBillingTransition('unbilled', 'paid') || '', /tidak diizinkan/);
  assert.equal(validateBillingTransition('invoiced', 'paid'), null);
  assert.match(validateBillingTransition('paid', 'invoiced') || '', /tidak diizinkan/);
});

test('final deal states cannot reopen and won requires prior sent or negotiation', () => {
  assert.equal(validateProposalTransition('draft', 'won')?.includes('tidak diizinkan'), true);
  assert.equal(validateProposalTransition('sent', 'won'), null);
  assert.equal(validateProposalTransition('won', 'negotiation')?.includes('tidak diizinkan'), true);
  assert.equal(validateProposalTransition('lost', 'draft')?.includes('tidak diizinkan'), true);
});
