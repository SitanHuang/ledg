
const a = {
  b: 123,
  c: Array(3).fill(Math.random())
};

console.time();

for (let i = 0;i < 100000;i++) {
  a.d = Object.assign({}, a);
}

console.timeEnd();

console.time();

for (let i = 0;i < 100000;i++) {
  a.d = { ...a };
}

console.timeEnd();