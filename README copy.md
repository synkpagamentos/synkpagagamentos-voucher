# Site Synk — Pacote de Handoff para Desenvolvimento

Protótipo de alta fidelidade do site da **Synk** (plataforma de pagamentos para
pesquisa — parte do Universo MOB INC.). Este pacote contém o front-end estático
(HTML + CSS + JS puro, sem dependências de build) pronto para servir de base à
implementação de produção.

> **Status:** protótipo validado para aparência, conteúdo e fluxo de telas.
> A camada de back-end, autenticação real, integração de pagamentos (Pix /
> Banco Central) e segurança **ainda precisam ser implementadas** pelo dev.

---

## 1. Estrutura de arquivos

```
handoff/
├── index.html        → Site institucional + formulário de resgate de voucher
├── login.html        → Tela de login do painel (cliente/admin)
├── dashboard.html    → Painel interno: cadastro de novos vouchers
├── assets/
│   ├── hero-home.jpg       → imagem de fundo do hero (home)
│   ├── login-bg.jpg        → imagem de fundo do login
│   └── dashboard-bg.jpg    → imagem de fundo do painel
└── README.md         → este arquivo
```

Fluxo de navegação:

```
index.html  ──(botão "Login")──►  login.html  ──(login válido)──►  dashboard.html
     ▲                                                                    │
     └──────────────────(botão "Voltar ao Site" / "Sair")────────────────┘
```

---

## 2. Como visualizar

Não há etapa de build. Basta abrir `index.html` num navegador, **ou** servir a
pasta com qualquer servidor estático (recomendado, para os caminhos relativos
das imagens funcionarem sem restrição de `file://`):

```bash
# Python
python3 -m http.server 8000
# depois acesse http://localhost:8000

# ou Node
npx serve
```

---

## 3. Credenciais e gatilhos de DEMO (substituir por lógica real)

### Login (`login.html`)
- Aceita **qualquer e-mail** + senha fixa **`synk2026`** (hard-coded no JS apenas
  para demonstração). **Substituir por autenticação real.**

### Formulário de Resgate (`index.html`, seção "Para Participantes")
A validação atual é simulada no front-end para demonstrar os 3 estados de
pop-up. O número do voucher dispara o cenário:

| Nº do voucher digitado            | Pop-up exibido                              |
|-----------------------------------|---------------------------------------------|
| `000000000`                       | 🟡 **Voucher Vencido**                       |
| `111111111` ou campos incompletos | 🔴 **Dados Incorretos**                      |
| Qualquer outro válido (tudo OK)   | 🟢 **Sucesso** (pagamento em até 1 dia útil) |

> **Para produção:** essa lógica deve ser substituída por chamada à API que
> valida o voucher (existência, validade/vencimento, status) e processa o Pix.

### Painel — Cadastro de Voucher (`dashboard.html`)
Campos: Valor, Quantidade, Nome do Projeto, Data de Vencimento. O envio apenas
exibe uma tela de sucesso simulada — **conectar ao back-end.**

---

## 4. Pontos de integração para o back-end

1. **Autenticação** (`login.html`) — substituir verificação de senha por
   endpoint de login + sessão/token. Tratar "Recuperar acesso".
2. **Resgate de voucher** (`index.html`) — `function resgatarVoucher()`:
   - validar voucher e vencimento no servidor;
   - validar dados bancários / chave Pix;
   - processar transferência Pix;
   - retornar o estado correto (vencido / dados incorretos / sucesso).
3. **Tipo de Chave Pix** — o `<select id="v-tipo-chave">` já lista os tipos
   oficiais do Banco Central (CPF, CNPJ, E-mail, Celular, Chave Aleatória/EVP).
   Adicionar validação de formato por tipo.
4. **Cadastro de vouchers** (`dashboard.html`) — `function submeter()`:
   persistir lote de vouchers (valor, quantidade, projeto, vencimento) e gerar
   os códigos/senhas.

---

## 5. Design System (referência)

### Tipografia (Google Fonts)
- **Títulos:** Playfair Display (400 / 700, normal e itálico)
- **Texto/UI:** DM Sans (300 / 400 / 500 / 600)

### Paleta
| Uso                         | HEX        |
|-----------------------------|------------|
| Verde principal             | `#3D5A2C`  |
| Verde médio (hover)         | `#5C7F3F`  |
| Verde lima (acento)         | `#B8E04F`  |
| Verde lima claro (fundos)   | `#D9F0A0`  |
| Verde card (login/painel)   | `#4F6F3C`  |
| Fundo claro                 | `#FAF8F2`  |
| Texto escuro                | `#1A1F18`  |

> No CSS as cores estão em `oklch()` (espaço de cor moderno). Os HEX acima são
> equivalentes aproximados para uso em ferramentas externas (ex.: Canva).

---

## 6. Observações técnicas

- **Sem dependências externas** além das fontes do Google Fonts (carregadas via
  `<link>`). Para ambiente offline/produção, considere hospedar as fontes
  localmente.
- **Responsivo** — breakpoints em `@media (max-width: 900px)` / `600px`.
- O `index.html` contém um pequeno painel "Tweaks" (canto inferior) que serve
  apenas ao ambiente de prototipagem; está oculto por padrão e pode ser
  **removido** com segurança na versão de produção (bloco `#tweaks-panel` no
  HTML/CSS e funções relacionadas no `<script>`).
- Imagens de fundo são fotos de stock (Unsplash) usadas como placeholder —
  **confirmar licenciamento** ou substituir por imagens próprias da marca.

---

*Gerado como pacote de handoff do protótipo Synk. Dúvidas sobre intenção de
design ou conteúdo: falar com a equipe Synk / MOB INC.*
