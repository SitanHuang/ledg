async function cmd_count(args) {
  args.modifiers.from = args.modifiers.from || '@min';
  args.modifiers.to = args.modifiers.to || '@max';
  
  report_set_modifiers(args);
  report_extract_account(args);
  report_extract_tags(args);
  report_set_accounts(args);
  report_compile_account_regex();
  
  let count = 0;
  await report_traverse(args, async function(entry) {
    count++;
  });
  
  console.log((count).toString());
}
