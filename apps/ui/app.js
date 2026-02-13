const server = "http://localhost:4020";
const out = document.getElementById("out");

function print(obj) {
  out.textContent = JSON.stringify(obj, null, 2);
}

document.getElementById("callPremium").onclick = async () => {
  const r = await fetch(`${server}/premium`);
  const j = await r.json();
  print({ status: r.status, body: j });
  if (r.status === 402 && j.paymentId) {
    document.getElementById("paymentId").value = j.paymentId;
  }
};

document.getElementById("fulfill").onclick = async () => {
  const paymentId = document.getElementById("paymentId").value.trim();
  const txid = document.getElementById("txid").value.trim();
  const hdr = JSON.stringify({ paymentId, txid });

  const r = await fetch(`${server}/premium`, { headers: { "X402-Payment": hdr } });
  const j = await r.json();
  print({ status: r.status, body: j });
};
