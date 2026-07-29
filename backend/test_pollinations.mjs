async function test() {
  try {
    const res = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hello' }]
      })
    });
    const text = await res.text();
    console.log("POST result:", text);
  } catch (e) {
    console.error("POST failed:", e.message);
  }

  try {
    const res2 = await fetch('https://text.pollinations.ai/hello');
    const text2 = await res2.text();
    console.log("GET result:", text2);
  } catch (e) {
    console.error("GET failed:", e.message);
  }
}
test();
