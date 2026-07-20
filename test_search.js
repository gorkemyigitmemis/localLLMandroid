const { performWebSearch } = require('./temp_out/searchEngine');

async function test() {
  console.log("Starting search...");
  try {
    const res = await performWebSearch("istanbul rize uçak bileti fiyatları");
    console.log("Result:\n" + res);
  } catch (e) {
    console.error("Error:", e);
  }
}
test();
