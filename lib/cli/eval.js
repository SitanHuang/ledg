async function cmd_eval(args) {
  args._.forEach(x => {
    console.log(eval(x) + '');
  });
}
