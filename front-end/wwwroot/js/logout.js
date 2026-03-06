document.getElementById("logoutBtn").addEventListener("click", async () => {
  const res = await fetch("http://localhost:3000/api/users/logout", {
    method: "POST",
    credentials: "include"
  });
  const data = await res.json();
  if (data.redirect) window.location.href = data.redirect;
});