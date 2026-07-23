/**
 * CONFIGURACAO DO GOOGLE SHEETS
 * 
 * 1. Depois de implantar o Google Apps Script, copie a URL de execucao
 * 2. Cole aqui no lugar de SUA_URL_AQUI
 * 
 * A URL deve terminar com /exec
 * Exemplo: https://script.google.com/macros/s/AKfycbxXXXX/exec
 */

const CONFIG = {
    // COLE SUA URL DO GOOGLE APPS SCRIPT AQUI:
    API_URL: 'https://script.google.com/macros/s/AKfycbzpyxyap1RNoT5LZGte73An_9G30JFn_chQ4XrXTqvWqwfGXSHEFevKZQDK7K-bIEDTAg/exec',
    
    // Nome do cache local (fallback offline)
    CACHE_KEY: 'frotaPro_cache',
    
    // Tempo maximo de cache em ms (5 minutos)
    CACHE_MAX_AGE: 5 * 60 * 1000
};
