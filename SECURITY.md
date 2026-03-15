# 🔒 Guia de Segurança

## Protegendo suas Credenciais Firebase

Este projeto usa Firebase e requer cuidado especial com as credenciais para evitar vazamentos no GitHub.

---

## ⚠️ Nunca commite o `firebase-config.js`!

O arquivo `firebase-config.js` contém suas chaves de API do Firebase e está listado no `.gitignore`.

Se você acidentalmente commitou suas credenciais:
1. **Imediatamente regenere sua API Key** no [Firebase Console](https://console.firebase.google.com)
2. Remova o arquivo do histórico do git:
   ```bash
   git rm --cached firebase-config.js
   git commit -m "remove: arquivo de config sensível"
   ```
3. Considere usar `git-filter-repo` para limpar o histórico completo.

---

## 🚀 Como Configurar em um Novo Clone

1. Clone o repositório:
   ```bash
   git clone https://github.com/Araujoacai/Pendencias.git
   cd Pendencias
   ```

2. Copie o template de configuração:
   ```bash
   cp firebase-config.example.js firebase-config.js
   ```

3. Edite `firebase-config.js` com suas credenciais reais do Firebase.

4. **Nunca commite o `firebase-config.js`!**

---

## 🛡️ Regras do Firestore

Configure regras de segurança no [Firebase Console](https://console.firebase.google.com) → Firestore → Regras:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Apenas permita leitura/escrita autenticada
    match /pendencias/{document=**} {
      allow read, write: if true; // Altere para autenticação quando necessário
    }
  }
}
```

---

## 🔑 Boas Práticas de API Key Firebase

- A `apiKey` do Firebase para web é **pública por design** – só serve para identificar o projeto.
- A segurança real é feita pelas **Regras do Firestore**.
- Restrinja sua API key no [Google Cloud Console](https://console.cloud.google.com) para aceitar apenas requisições do seu domínio.

---

## 📞 Reportar Vulnerabilidades

Se você encontrar uma vulnerabilidade de segurança, entre em contato diretamente antes de abrir uma issue pública.
