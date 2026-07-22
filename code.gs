function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    var action = e.parameter.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var result = { success: false };

    switch(action) {
      case 'getVeiculos':
        result = getSheetData(ss, 'Veiculos');
        break;
      case 'addVeiculo':
        result = addRow(ss, 'Veiculos', JSON.parse(e.postData.contents).data);
        break;
      case 'updateVeiculo':
        result = updateRow(ss, 'Veiculos', 'Placa', JSON.parse(e.postData.contents).data);
        break;
      case 'deleteVeiculo':
        result = deleteRow(ss, 'Veiculos', 'Placa', e.parameter.id);
        break;

      case 'getAbastecimentos':
        result = getSheetData(ss, 'Abastecimentos');
        break;
      case 'addAbastecimento':
        result = addRow(ss, 'Abastecimentos', JSON.parse(e.postData.contents).data);
        break;
      case 'updateAbastecimento':
        result = updateRow(ss, 'Abastecimentos', 'ID', JSON.parse(e.postData.contents).data);
        break;
      case 'deleteAbastecimento':
        result = deleteRow(ss, 'Abastecimentos', 'ID', e.parameter.id);
        break;

      case 'getManutencoes':
        result = getSheetData(ss, 'Manutencoes');
        break;
      case 'addManutencao':
        result = addRow(ss, 'Manutencoes', JSON.parse(e.postData.contents).data);
        break;
      case 'updateManutencao':
        result = updateRow(ss, 'Manutencoes', 'ID', JSON.parse(e.postData.contents).data);
        break;
      case 'deleteManutencao':
        result = deleteRow(ss, 'Manutencoes', 'ID', e.parameter.id);
        break;

      case 'getMotoristas':
        result = getSheetData(ss, 'Motoristas');
        break;
      case 'addMotorista':
        result = addRow(ss, 'Motoristas', JSON.parse(e.postData.contents).data);
        break;
      case 'updateMotorista':
        result = updateRow(ss, 'Motoristas', 'ID', JSON.parse(e.postData.contents).data);
        break;
      case 'deleteMotorista':
        result = deleteRow(ss, 'Motoristas', 'ID', e.parameter.id);
        break;

      case 'getConfiguracoes':
        result = getSheetData(ss, 'Configuracoes');
        break;
      case 'updateConfiguracao':
        result = updateConfig(ss, JSON.parse(e.postData.contents));
        break;

      case 'setupSheets':
        result = setupSheets(ss);
        break;

      default:
        result = { success: false, error: 'Ação não reconhecida: ' + action };
    }

    return jsonResponse(result);

  } catch(err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
}

function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
}

function setupSheets(ss) {
  var sheets = ['Configuracoes', 'Veiculos', 'Abastecimentos', 'Manutencoes', 'Motoristas'];
  var headers = {
    'Configuracoes': ['Chave', 'Valor'],
    'Veiculos': ['Placa', 'Grupo', 'Marca', 'Modelo', 'Ano', 'Cor', 'Chassi', 'Renavam', 'Hodometro', 'Status', 'Dt_Aquisicao', 'Dt_Venda'],
    'Abastecimentos': ['ID', 'Placa', 'Data', 'Litros', 'Valor', 'Km', 'Posto', 'Tipo_Combustivel'],
    'Manutencoes': ['ID', 'Placa', 'Data', 'Tipo', 'Descricao', 'Valor_Pecas', 'Valor_MaoObra', 'Km_Atual', 'Km_Proxima', 'Status'],
    'Motoristas': ['ID', 'Nome', 'CNH', 'Categoria', 'Validade_CNH', 'Telefone', 'Email', 'Status']
  };

  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i];
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(headers[name]);
      sheet.getRange(1, 1, 1, headers[name].length).setFontWeight('bold').setBackground('#2962ff').setFontColor('#ffffff');
    }
  }
  return { success: true, message: 'Planilhas criadas com sucesso' };
}

function getSheetData(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { success: false, error: 'Aba ' + sheetName + ' não encontrada' };

  var data = sheet.getDataRange().getValues();
  if (data.length < 1) return { success: true, data: [] };

  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    rows.push(row);
  }
  return { success: true, data: rows };
}

function addRow(ss, sheetName, rowData) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { success: false, error: 'Aba não encontrada' };

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var newRow = [];
  for (var i = 0; i < headers.length; i++) {
    newRow.push(rowData[headers[i]] !== undefined ? rowData[headers[i]] : '');
  }
  sheet.appendRow(newRow);
  return { success: true, message: 'Registro adicionado' };
}

function updateRow(ss, sheetName, keyColumn, rowData) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { success: false, error: 'Aba não encontrada' };

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var keyIndex = headers.indexOf(keyColumn);
  if (keyIndex === -1) return { success: false, error: 'Coluna chave não encontrada' };

  var data = sheet.getDataRange().getValues();
  var keyValue = rowData[keyColumn];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][keyIndex]) === String(keyValue)) {
      for (var j = 0; j < headers.length; j++) {
        if (rowData[headers[j]] !== undefined) {
          sheet.getRange(i + 1, j + 1).setValue(rowData[headers[j]]);
        }
      }
      return { success: true, message: 'Registro atualizado' };
    }
  }
  return { success: false, error: 'Registro não encontrado' };
}

function deleteRow(ss, sheetName, keyColumn, keyValue) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { success: false, error: 'Aba não encontrada' };

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var keyIndex = headers.indexOf(keyColumn);
  if (keyIndex === -1) return { success: false, error: 'Coluna chave não encontrada' };

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][keyIndex]) === String(keyValue)) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Registro removido' };
    }
  }
  return { success: false, error: 'Registro não encontrado' };
}

function updateConfig(ss, data) {
  var sheet = ss.getSheetByName('Configuracoes');
  if (!sheet) {
    sheet = ss.insertSheet('Configuracoes');
    sheet.appendRow(['Chave', 'Valor']);
  }
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === data.chave) {
      sheet.getRange(i + 1, 2).setValue(data.valor);
      return { success: true, message: 'Configuração atualizada' };
    }
  }
  sheet.appendRow([data.chave, data.valor]);
  return { success: true, message: 'Configuração adicionada' };
}
