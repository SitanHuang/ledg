import { describe, it, expect } from 'vitest';
import { AccountGlob } from './accountGlob.ts';

// Minimal stub for Account with identifier property
class Account { constructor(public identifier: string) { } }

// Helper to apply glob against an account identifier
function match(pattern: string, identifier: string): boolean {
  return new AccountGlob(pattern).execute(new Account(identifier));
}

describe('AccountGlob', () => {
  it('should match patterns exactly', () => {
    expect(match('Equity.Open', 'Equity.Open')).toBe(true);
    expect(match('Equity.Open', 'Equity.Close')).toBe(false);
  });

  // Wildcard * matches zero or more characters across segments
  it('should handle "*" wildcard across segments', () => {
    expect(match('*', 'Any.Account.Name')).toBe(true);
    expect(match('exp*', 'Expense.Account')).toBe(true);
    expect(match('exp*', 'Income.Account')).toBe(false);
  });

  // Specific wildcard patterns
  it('should match "*.cash" pattern', () => {
    expect(match('*.cash', 'Account.Current.Cash')).toBe(true);
    expect(match('*.cash', 'CashAccount')).toBe(false);
  });

  // Escaping special characters
  it('should escape literal dots and asterisks', () => {
    expect(match('a\\.b', 'a.b')).toBe(true);
    expect(match('a\\.b', 'axb')).toBe(false);
    expect(match('acc\\*.cash', 'acc*.cash')).toBe(true);
    expect(match('acc\\*.cash', 'account.cash')).toBe(false);
  });

  // Alternation
  it('should support alternation with braces', () => {
    expect(match('{exp,inc}.sl', 'Expense.salary')).toBe(true);
    expect(match('{exp,inc}.sl', 'Income.Salary')).toBe(true);
    expect(match('{exp,inc}.sl', 'Revenue.Salary')).toBe(false);
    expect(match('{revenue.salary}', 'revenue.salary')).toBe(true);
    expect(match('{revenue.salary}', 'revenueasalary')).toBe(false);
    expect(match('{revenue.salary}', 'revenue..salary')).toBe(false);
    expect(match('{revenue.salary}', 'revenuesalary')).toBe(false);
    expect(match('{revenue.salary}', 'revenue.salarya')).toBe(true);
  });

  // Regex literal mode
  it('should accept full regex when pattern starts with \\v', () => {
    expect(match('\\v^Equity$', 'Equity')).toBe(true);
    expect(match('\\v^(Equity)$', 'Equity')).toBe(true);
    expect(match('\\v^Equity$', 'Equity.Open')).toBe(false);
  });

  // String literal mode
  it('should match exact string when pattern starts with "!"', () => {
    expect(match('!Equity', 'Equity')).toBe(true);
    expect(match('!equity', 'Equity')).toBe(false);
    expect(match('\\v^(?!Equity)', 'Equity.Open')).toBe(false);
    expect(match('\\v^(?!Equity)', 'aEquity.Open')).toBe(true);
  });

  // Dot matching segment letters sequence
  it('should match letters within segments when using leading dot', () => {
    expect(match('.cash', 'Account.Current.Cash')).toBe(false);
    expect(match('..cash', 'Account.Current.Cash')).toBe(true);
    expect(match('..cash', 'Account.Current..Cash')).toBe(false);
    expect(match('...cash', 'Account.Current..Cash')).toBe(true);
    expect(match('.cash', 'Account.Chaosh')).toBe(true);
    expect(match('.cash', 'Account.CashFlow')).toBe(true);
    expect(match('.cash', 'Account.CFS')).toBe(false);
  });

  // Double wildcard semantics
  it('should handle multi "*" patterns', () => {
    expect(match('**.open', 'Equity.Opening')).toBe(true);
    expect(match('**.open', 'Opening.Account')).toBe(false);
    expect(match('**.open', 'Close.Account')).toBe(false);
  });

  // Case-insensitivity
  it('should match patterns case-insensitively', () => {
    expect(match('Exp*.Sal', 'expense.Salary')).toBe(true);
    expect(match('exp*.sal', 'EXpENSE.SALARY')).toBe(true);
  });
});
