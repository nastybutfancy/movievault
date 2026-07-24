const API_URL = "https://script.google.com/macros/s/AKfycbyQTE2JyHjVngVHs-OlLIuMHknWa-u81Jx-jG8sJ1K8WpbQi5NZYDvRHOLy2C1gFzoKTQ/exec";

export function apiRequest(action, parameters = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = `movieVaultCallback_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const script = document.createElement("script");
    const query = new URLSearchParams({ action, callback: callbackName, ...parameters });

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Serwer nie odpowiedział."));
    }, 20000);

    function cleanup() {
      clearTimeout(timeout);
      script.remove();
      delete window[callbackName];
    }

    window[callbackName] = data => {
      cleanup();
      if (data?.success === false) {
        reject(new Error(data.message || "Wystąpił błąd API."));
        return;
      }
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Nie udało się połączyć z Arkuszem Google."));
    };

    script.src = `${API_URL}?${query.toString()}`;
    document.body.appendChild(script);
  });
}
