# Frota Pro - Controle de Frota com Google Sheets

Sistema completo de gestão de frota que utiliza **Google Sheets** como backend e **Google Apps Script** como API REST, funcionando como um **PWA (Progressive Web App)** com modo offline.

---

## Funcionalidades

- Cadastro de veículos com dados completos
- Registro de abastecimentos
- Controle de manutenções (preventiva e corretiva)
- Gestão de motoristas
- Alertas automáticos (revisão, troca de óleo, etc.)
- Relatórios com filtros por período e veículo
- Dashboard com gráficos interativos
- Modo escuro / claro
- Funciona offline (PWA)
- Responsivo para celular e tablet

---

## Estrutura da Planilha Google Sheets

Crie uma nova planilha no Google Sheets com as seguintes abas exatamente com esses nomes:

### Aba: `Configuracoes`
| Coluna A       | Coluna B           |
|----------------|--------------------|
| API_URL        | (URL do deploy do Apps Script) |
| VERSAO         | 1.0                |
| ULTIMA_SINCRONIZACAO | (data)     |

### Aba: `Veiculos`
| Placa | Grupo | Marca | Modelo | Ano | Cor | Chassi | Renavam | Hodometro | Status | Dt_Aquisicao | Dt_Venda |

### Aba: `Abastecimentos`
| ID | Placa | Data | Litros | Valor | Km | Posto | Tipo_Combustivel |

### Aba: `Manutencoes`
| ID | Placa | Data | Tipo | Descricao | Valor_Pecas | Valor_MaoObra | Km_Atual | Km_Proxima | Status |

### Aba: `Motoristas`
| ID | Nome | CNH | Categoria | Validade_CNH | Telefone | Email | Status |

---

## Configurando o Google Apps Script

1. Abra a planilha criada acima
2. Vá em **Extensões > Apps Script**
3. Delete o código padrão e cole todo o conteúdo do arquivo `apps-script/Code.gs`
4. Cole também o código do arquivo `apps-script/appsscript.json` no editor do Apps Script
5. Clique em **Implantar > Novo Implantação**
6. Escolha tipo **Aplicativo da Web**
7. Execute como: **Eu** | Acesso: **Qualquer pessoa**
8. Clique em **Implantar** e autorize as permissões
9. Copie a **URL de execução** (algo como `https://script.google.com/macros/s/.../exec`)

---

## Configurando o Aplicativo

1. Abra o arquivo `js/config.js`
2. Substitua a URL pela que você copiou do Apps Script:

```javascript
const CONFIG = {
    API_URL: 'https://script.google.com/macros/s/SEU_ID_AQUI/exec',
    // ...
};
```

3. Salve o arquivo

---

## Hospedando o App

Você pode hospedar o app de várias formas:

### Opção 1: GitHub Pages (Gratuito)
1. Crie um repositório no GitHub
2. Envie todos os arquivos do app
3. Vá em **Configurações > Pages**
4. Selecione o branch `main` e pasta `/ (root)`
5. Acesse a URL gerada

### Opção 2: Netlify / Vercel (Gratuito)
1. Faça upload dos arquivos
2. O app estará online em segundos

### Opção 3: Servidor Próprio
1. Envie os arquivos para qualquer servidor web estático (Apache, Nginx, etc.)
2. Acesse via navegador

---

## Instalando no Celular (PWA)

1. Abra o app no Chrome/Safari do celular
2. Toque em **Adicionar à tela inicial**
3. O app será instalado como um app nativo com ícone

---

## Primeiro Acesso

1. Ao abrir o app, ele buscará os dados do Google Sheets
2. O sistema criará automaticamente a aba `Configuracoes` se não existir
3. A senha padrão para acessar configurações é: **frota2025**

---

## Alertas Automáticos

O sistema gera alertas quando:
- Veículo atinge a quilometragem da próxima manutenção
- CNH do motorista está próxima do vencimento
- Veículo está com revisão atrasada (15 dias após a data prevista)

---

## Licença

MIT - Livre para uso pessoal e comercial.
