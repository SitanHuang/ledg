function fzy_compare(q, acc) {
  let rgx = fzy_compile(q);
  return !!acc.match(rgx);
}

function fzy_compile(q) {
  if (q.indexOf('\\v') == 0)
    return new RegExp(q.substring(2));
  q = ("^[^.]*" + q
    .replace(/\*/g, '␞')
    .replace(/\./g, '[^.]*\\.[^.]*')
    .replace(/([a-z])/gi, '[^.]*$1[^.]*') + '[^.]*$')
    .replace(/\[\^\.\]\*\[\^\.\]\*/g, '[^.]*')
    .replace(/\[\^\.\]\*\.\*/g, '.*')
    .replace(/␞/g, '.*?');

  return new RegExp(q, 'i');
}

/* ------------------------------------------------------------------
   glob_compile – turn a Unix‑glob pattern ('.' = segment separator)
   into a RegExp.  Features:
     *   → any run of chars except '.'     (** = across segments)
     ?   → any single char except '.'
     [...]  POSIX character classes
     {a,b}  alternation                    (nested braces not supported)
   The output regex is case‑insensitive and anchored ^…$
   ------------------------------------------------------------------ */
function glob_compile(pattern) {
  let i = 0, esc = false, rx = '^';

  const reEsc = /[-/\\^$+?.()|[\]{}*]/g;
  const quot = s => s.replace(reEsc, '\\$&'); // escape literal run

  while (i < pattern.length) {
    let c = pattern[i++];

    /* literal backslash */
    if (esc) {
      rx += quot(c);
      esc = false;
      continue;
    }
    if (c === '\\') { esc = true; continue; }
    switch (c) {
      case '*':                           // "*"  or "**"
        rx += '.*';      // "*"  ⇒ cross dot
        break;

      case '?': rx += '[^.]'; break;          // '?'   ⇒ single char

      case '{':                                       // {a,b,c}
        let alt = '';
        while (i < pattern.length && pattern[i] !== '}') alt += pattern[i++];
        i++;                                          // skip the '}'
        rx += '(?:' + alt.split(',').map(quot).join('|') + ')';
        break;

      case '.': rx += '[^.]*?\\.'; break;                 // literal dot

      default: rx += "[^.]*?" + quot(c);                      // ordinary literal
    }
  }
  rx += '[^.]*?$';
  return new RegExp(rx, 'i');
}

(function () {
  const sampleAccounts = [
    'Expense.Free.Leisure.Games',
    'Equity.Parents',
    'Expense.Essential.Utilities.Phone',
    'Expense.Other.Education.Meal',
    'Expense.Free.Retail.Tech',
    'Equity.Parents.Amazon',
    'Expense.Essential.Auto.License',
    'Expense.Free.Retail.CSJ',
    'Expense.Other.Education.Supplies',
    'Expense.Other.Education.Tuition',
    'Expense.Free.Retail.Fitness.Cycling',
    'Expense.Essential.Groceries.Food',
    'Expense.Free.Leisure.Movies',
    'Expense.Essential.Health.Dental',
    'Expense.Essential.Health.Equipments',
    'Expense.Other.Education.Fees',
    'Expense.Free.Leisure.Violin',
    'Expense.Other.Education',
    'Expense.Other.Education.Books',
    'Asset.Current.Cash',
    'Equity.OpeningBalances',
    'Income.Tips',
    'Income',
    'Expense.Essential.Health.Medical',
    'Expense.Essential.Groceries.PersonalCare',
    'Asset.Savings.CashReserve',
    'Expense.Essential.Immigration',
    'Asset.Current.BoA.Checking',
    'Asset.Current.BoA.Saving',
    'Asset.Savings.MinBalance',
    'Income.Gifts',
    'Expense.RecDiff.Cash',
    'Expense.Other.Travel.Flight',
    'Expense.Free.Leisure.Skating',
    'Expense.Essential.Insurance.Health',
    'Expense.Essential.Housing',
    'Expense.Other.Education.Scholarships',
    'Expense.Essential.Insurance.Health',
    'Asset.Current.CommodoreCash',
    'Expense.Other.Travel.Hotel',
    'Expense.Free.Leisure.Dining',
    'Expense.Other.Travel.CarRental',
    'Expense.Essential.Groceries',
    'Asset.Receivable.Vanderbilt',
    'Income.Stipend',
    'Expense.Other.Gifts',
    'Expense.Free.Leisure',
    'Asset.Receivable.JakeDu',
    'Expense.Essential.PersonalCare.Haircut',
    'Expense.Essential.Health.Drugs',
    'Expense.Essential.Groceries.Household',
    'Expense.Other.Travel.Uber',
    'Expense.Free.Retail.Fitness',
    'Expense.RecDiff.Coins',
    'Asset.Receivable.Vanderbilt.CommodoreCash',
    'Expense.Free.Other',
    'Asset.Receivable.Vouchers.Spirit',
    'Expense.Essential.Other',
    'Expense.Free.Leisure.Concert',
    'Expense.Other.Storage',
    'Asset.Receivable.KunQiu',
    'Asset.Receivable.BrandonSmith',
    'Expense.Essential.Housing.Furnishings',
    'Expense.Essential.Tools',
    'Asset.Receivable.DylanConger',
    'Asset.Receivable.Vouchers.Instacart',
    'Asset.Receivable.AaronGothard',
    'Asset.Receivable.Amazon',
    'Income.Salary.SummerBridge2022',
    'Asset.Receivable.Vanderbilt.SummerBridge',
    'Expense.Taxes.Federal.SocialSecurity',
    'Expense.Taxes.Federal.Medicare',
    'Expense.Essential.PersonalCare',
    'Expense.Free.Retail',
    'Expense.Other.Other',
    'Expense.Free.Subscriptions.GoogleOne',
    'Asset.Receivable.AirBnB',
    'Expense.Free.Leisure.Exhibit',
    'Income.Salary',
    'Expense.Taxes.Federal',
    'Expense.Taxes.State',
    'Expense.Other.Travel.Train',
    'Asset.Receivable.Taxes.Federal',
    'Asset.Receivable.Taxes.State',
    'Liability.Current.BoA.CreditCard',
    'Expense.Essential.Health.Therapy',
    'Asset.Savings.ContingencyFund',
    'Expense.Essential.Finance.Services',
    'Asset.Current.CIT.PlatinumSaving',
    'Expense.Other.Travel.Parking',
    'Income.Investment.Interest',
    'Expense.Other.Travel.Shipping',
    'Expense.Essential.Auto.Wash',
    'Asset.Receivable.Muhlenberg',
    'Expense.Essential.Auto.Gas',
    'Expense.Essential.Laundry',
    'Expense.Other.Travel.Bus',
    'Expense.Free.Leisure.Alcohol',
    'Imbalance',
    'Expense.Other.Travel.Toll',
    'Expense.Free.Leisure.Parks',
  ];

  const patterns = [
    '*gro.pcare',
    '*boa.chk',
    '..amz',
    'et.prnt',
    '*plat',
    'inc.sal',
  ];
  const globPatterns = [
    '**gro.pcare',
    '**boa.chk',
    '..amz',
    'et.prnt',
    '**plat',
    'inc.sal',
  ];

  const rounds = 1e4;

  for (let i = 0;i < patterns.length;i++) {
    const pattern = patterns[i];
    // const globPattern = globPatterns[i];
    const globPattern = pattern;
    const rFzy = fzy_compile(pattern);
    const rGlob = glob_compile(globPattern);

    console.log(`Benchmarking ${rounds} × ${sampleAccounts.length} matches: "${pattern}" / "${globPattern}"`);

    console.time('  fzy_compile / match');
    let matched = 0;
    for (let n = 0; n < rounds; n++) {
      for (const acc of sampleAccounts) if (rFzy.test(acc)) matched++;
    }
    console.timeEnd('  fzy_compile / match');
    console.log("    matched: " + matched)

    console.time('  glob_compile / match');
    matched = 0;
    for (let n = 0; n < rounds; n++) {
      for (const acc of sampleAccounts) if (rGlob.test(acc)) matched++;
    }
    console.timeEnd('  glob_compile / match');
    console.log("    matched: " + matched)
  }
})();
