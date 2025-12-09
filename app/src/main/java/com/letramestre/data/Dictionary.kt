package com.letramestre.data

/**
 * Dicionário de palavras válidas em português brasileiro.
 * Contém palavras comuns e permite validação manual.
 */
object Dictionary {
    
    private val validWords = mutableSetOf<String>()
    private val manuallyApprovedWords = mutableSetOf<String>()
    
    init {
        loadBaseWords()
    }
    
    private fun loadBaseWords() {
        // Palavras comuns em português - lista expandida
        val baseWords = listOf(
            // 2 letras
            "AI", "AR", "AS", "AO", "DA", "DE", "DO", "EM", "EU", "IR", "JA", "LA", "LO",
            "MA", "ME", "NA", "NO", "NU", "OS", "OU", "PA", "PO", "QUE", "SE", "SO", "TE",
            "TU", "UM", "VA", "VI", "VE",
            // 3 letras
            "ABA", "ABI", "ACO", "ADA", "AFO", "AGO", "ALA", "ALI", "AMO", "ANO", "APE",
            "ARA", "ATA", "AVE", "AVO", "BAR", "BOA", "BOI", "BOM", "CAI", "CAO", "CEM",
            "CEU", "CHA", "COM", "COR", "CRU", "DAR", "DEU", "DIA", "DOM", "DOR", "DOS",
            "DUA", "ELA", "ELE", "ERA", "ETC", "FAZ", "FEZ", "FIM", "FOI", "FOZ", "GAS",
            "GEL", "GIZ", "GOL", "HEI", "IDA", "IRE", "ISO", "IVO", "JAZ", "JOA", "LAR",
            "LER", "LEU", "LUA", "LUZ", "MAE", "MAL", "MAO", "MAR", "MAS", "MAU", "MEL",
            "MES", "MEU", "MIL", "MIM", "NAO", "NEM", "NOS", "OCA", "OLA", "OLO", "ORA",
            "OSO", "OVO", "PAI", "PAR", "PAS", "PAU", "PEZ", "POR", "POS", "PRO", "PUA",
            "QUE", "REM", "REU", "RIO", "RIR", "RUA", "RUM", "SAL", "SAO", "SEM", "SEU",
            "SIM", "SOB", "SOL", "SOM", "SOS", "SUA", "TAL", "TAO", "TEM", "TER", "TIA",
            "TIO", "TOP", "TUA", "TUE", "UMA", "UNS", "UVA", "VAI", "VAN", "VEM", "VER",
            "VEZ", "VIA", "VIR", "VIU", "VOZ", "ZEN",
            // 4 letras
            "ABRA", "ACAO", "ACOR", "AGUA", "ALAS", "ALMA", "ALTA", "ALTO", "AMEI", "AMEM",
            "AMOR", "ANDA", "ANOS", "ANTE", "AQUI", "AREA", "ARMA", "ARTE", "ASAS", "ASIA",
            "AZUL", "BALA", "BEBE", "BELA", "BELO", "BENS", "BIFE", "BOCA", "BOLA", "BOLO",
            "BOOM", "BROA", "CADA", "CAFE", "CAMA", "CANA", "CAPA", "CARA", "CASA", "CASO",
            "CEDO", "CEIA", "CHIA", "CINCO", "COLA", "COMO", "COPA", "COPO", "CORA", "CRUZ",
            "CUBO", "DADO", "DAMA", "DANO", "DATA", "DEDO", "DELE", "DEUS", "DIAS", "DICA",
            "DIGO", "DITO", "DOIS", "DONA", "DONO", "DOSE", "DUAS", "DURA", "DURO", "EITA",
            "ELAS", "ELES", "ENTE", "ESSA", "ESSE", "ESTA", "ESTE", "EURO", "FACE", "FACA",
            "FADO", "FALA", "FAMA", "FASE", "FATO", "FAVO", "FERA", "FILA", "FINO", "FITA",
            "FOGO", "FOME", "FORA", "FOTO", "FRIO", "FUGA", "GALO", "GATO", "GELO", "GEMA",
            "GIRA", "GIRO", "GOTA", "HORA", "HOJE", "HUGO", "IDEIA", "ILHA", "INDO", "ISSO",
            "ITEM", "JACA", "JATO", "JOAO", "JOGO", "JOIA", "JURA", "LADO", "LAGO", "LAMA",
            "LATA", "LAVA", "LEAO", "LEIS", "LEMA", "LEVA", "LIMA", "LIMO", "LISO", "LOJA",
            "LOTE", "LOUA", "LUIZ", "LUTA", "MACA", "MAGO", "MAIO", "MAIS", "MALA", "MANA",
            "MANO", "MAPA", "MARE", "MATA", "MATO", "MAXA", "MEDO", "MEIA", "MEIO", "MESA",
            "META", "MEUS", "MICA", "MINA", "MIMO", "MITO", "MODA", "MODO", "MOER", "MOLA",
            "MONO", "MORA", "MORO", "MOTO", "MOXA", "MUIA", "MUITO", "MURO", "NABO", "NADA",
            "NATA", "NAVE", "NELA", "NELE", "NETA", "NETO", "NEVA", "NEVE", "NILO", "NINO",
            "NOME", "NORA", "NOTA", "NOVA", "NOVO", "NUCA", "OBRA", "OITO", "OLHA", "OLHO",
            "ONDE", "OUVE", "PACA", "PAGA", "PAGO", "PAIS", "PARA", "PARE", "PARO", "PASO",
            "PATA", "PATO", "PEDI", "PEGA", "PEGO", "PELE", "PELO", "PENA", "PERA", "PESA",
            "PESO", "PICA", "PICO", "PINO", "PISO", "PODE", "POLO", "POMO", "POPA", "PORO",
            "POTE", "POVO", "RABO", "RACA", "RAIA", "RAIO", "RALO", "RAMO", "RATO", "REAL",
            "REDE", "RELA", "REMO", "RETO", "REZA", "RICA", "RICO", "RIMA", "RISO", "RITO",
            "ROBO", "ROCA", "RODA", "ROLA", "ROMA", "ROTA", "RUDE", "RUIM", "RUMO", "RUNA",
            "SABE", "SACO", "SAGA", "SALA", "SAPA", "SAPO", "SEDA", "SEDE", "SEJA", "SELO",
            "SETA", "SINO", "SOBE", "SOCO", "SOFA", "SOJA", "SOLO", "SOMA", "SONO", "SOPA",
            "SORO", "SUAS", "SUCO", "SUJO", "SUMO", "TACA", "TACO", "TAPA", "TAXA", "TEIA",
            "TELA", "TEMA", "TEMO", "TERA", "TETO", "TEUS", "TEVE", "TIAS", "TINA", "TIPO",
            "TIRA", "TOCA", "TODA", "TODO", "TOMA", "TOMO", "TOPO", "TORA", "TORO", "TREM",
            "TRES", "TUBO", "TUDO", "UBER", "UNHA", "URNA", "URSO", "USEI", "USAR", "VACA",
            "VAGA", "VAGO", "VALE", "VARA", "VASO", "VEJO", "VELA", "VENS", "VERA", "VIDA",
            "VILA", "VIRA", "VIVO", "VOAR", "VOCE", "VOGA", "VOMO", "VOTO", "ZERO", "ZONA",
            // 5+ letras
            "ABRIR", "ACABA", "ACIMA", "ADEUS", "AFETAR", "AINDA", "AJUDA", "AJUDAR", "ALEGA",
            "ALEGRE", "ALGUM", "AMIGA", "AMIGO", "ANDAR", "ANTES", "ANTIGO", "ANZOL", "APOIO",
            "AQUELA", "AQUELE", "AREAS", "AREIA", "ARMAS", "ASSIM", "ATIRA", "ATUAL", "BAIXA",
            "BAIXO", "BANCO", "BANCA", "BANDA", "BANHO", "BARCO", "BARES", "BARRO", "BASES",
            "BASTA", "BELEZA", "BICHO", "BLOCO", "BOLSA", "BOMBA", "BRACO", "BREVE", "BRIGA",
            "BUSCA", "BUSCAR", "CABIA", "CABRA", "CACAU", "CACOS", "CAIDO", "CAIXA", "CALOR",
            "CALMA", "CAMAS", "CAMPO", "CANAL", "CANTO", "CAPAZ", "CARNE", "CARRO", "CARTA",
            "CASAS", "CASOS", "CAUSA", "CAUDA", "CEGOS", "CENAS", "CENTO", "CERTO", "CHAMA",
            "CHAVE", "CHEGA", "CHEIO", "CHORA", "CHUVA", "CLUBE", "COLAR", "COISA", "COISAS",
            "COLHER", "COMER", "COMUM", "CONDE", "CONTA", "CONTAR", "CONTO", "CORPO", "CORRE",
            "CORTE", "COSTA", "COUBE", "COZINHA", "CRIME", "CRUZA", "CULPA", "CURTO", "CUSTO",
            "DANCA", "DANDO", "DAQUI", "DEIXA", "DEIXAR", "DELAS", "DELES", "DEMAIS", "DENSO",
            "DENTRO", "DESDE", "DESTA", "DESTE", "DIFÍCIL", "DISSE", "DIZER", "DIZEM", "DOCES",
            "DOBRO", "DORME", "DROGA", "DURAS", "DUROS", "EFEITO", "EMBORA", "EMPREGO", "ENFIM",
            "ENTRE", "ENTRO", "EQUIPAR", "ERRADO", "ESCALA", "ESCOLHA", "ESCOLA", "ESCREVE",
            "ESPACO", "ESPERA", "ESPERO", "ESTADO", "ESTAR", "ESTAVA", "ESTOU", "ESTRELA",
            "ESTUDO", "EXATO", "EXISTE", "EXISTE", "FACIL", "FALAR", "FALHA", "FALSO", "FALTA",
            "FAZER", "FECHA", "FELIZ", "FESTA", "FICAM", "FICAR", "FICA", "FILHO", "FILME",
            "FINAL", "FIRME", "FLOR", "FLORES", "FOGE", "FOLHA", "FORCA", "FORMA", "FORTE",
            "FOSSO", "FRACO", "FRENTE", "FRUTA", "FUNDO", "GANHAR", "GANHO", "GANHA", "GENTE",
            "GIRAR", "GLOBO", "GOLPE", "GORDA", "GORDO", "GOSTOS", "GRACA", "GRANDE", "GRAVA",
            "GRAVE", "GRITO", "GROUP", "GRUPO", "GUARDA", "GUERRA", "HAVIA", "HORAS", "HOTEL",
            "HUMANO", "IDADE", "IDEAL", "IDEIA", "IGREJA", "IGUAL", "IMAGEM", "INICIO", "INTEIRO",
            "INVERNO", "JOGADOR", "JOGAR", "JOGOS", "JOVEN", "JUNTO", "JUSTO", "LADOS", "LARGO",
            "LEGAL", "LEITE", "LENTO", "LETRA", "LEVAR", "LEVAS", "LIVRE", "LINDO", "LINHA",
            "LISTA", "LIVRO", "LOCAL", "LONGO", "LONGE", "LOUCO", "LUGAR", "LUTAR", "MACHO",
            "MAIOR", "MANHA", "MARCO", "MARCA", "MARIA", "MASSA", "MAIOR", "MATAR", "MEDIA",
            "MEDICO", "MESMO", "MESES", "METER", "MEXER", "MILHO", "MINHA", "MINHA", "MUNDO",
            "MONTE", "MORAL", "MORAR", "MORTE", "MOSTRA", "MOTIVO", "MOTOR", "MUITO", "MULHER",
            "MUNDO", "MUSICA", "NADAR", "NASCER", "NEGRO", "NORTE", "NOITE", "NOMES", "NOSSO",
            "NOSSA", "NOSSA", "NOTAR", "NUNCA", "OBRAS", "OBVIO", "OCEANO", "OLHAR", "OLHOS",
            "ONTEM", "ORDEM", "OUTROS", "OUTRA", "OUTRO", "OUVIR", "PADRE", "PAGAR", "PAIXAO",
            "PALCO", "PAPEL", "PARES", "PARTE", "PARTIR", "PASSO", "PASTA", "PAUSA", "PEDIR",
            "PEDRA", "PEITO", "PENSA", "PENSAR", "PEQUENO", "PERDA", "PERDE", "PERDER", "PERTO",
            "PESADO", "PESSOA", "PIANO", "PLANO", "PLANTA", "PODER", "POETA", "PONTO", "POBRE",
            "POLICIA", "PORTA", "POSTO", "POUCO", "PRAÇA", "PRAIA", "PRATO", "PRECO", "PRETO",
            "PRIMA", "PRIMO", "PROVAR", "PROVA", "PRUMO", "PULAR", "PUXAR", "QUADRO", "QUAL",
            "QUALQUER", "QUANDO", "QUANTO", "QUARTO", "QUASE", "QUATRO", "QUEDA", "QUEM",
            "QUENTE", "QUERER", "QUINTA", "QUIETO", "RADIO", "RAIVA", "RAPAZ", "RAZAO", "RECEBER",
            "REDE", "REGIA", "REGRA", "REINO", "REMAR", "RESTA", "RESTO", "REUNIR", "RISCO",
            "ROCHA", "RODAR", "ROLHA", "ROMPE", "ROUPA", "SABER", "SACOLA", "SALDO", "SALTO",
            "SALVA", "SANTA", "SANTO", "SAUDE", "SECA", "SECO", "SEGUIR", "SEGURO", "SELVA",
            "SEMPRE", "SENHOR", "SENSO", "SENTIR", "SERIO", "SERVE", "SERVIR", "SEXO", "SIGNO",
            "SILENCIO", "SIMPLES", "SINAL", "SOBRE", "SOBRA", "SOCIAL", "SOFRE", "SOLTO",
            "SONHAR", "SONHO", "SORTE", "SORRIR", "SUAVE", "SUBIR", "SUGAR", "SUJAR", "SUMIR",
            "SUPER", "SURDO", "TABLE", "TANTO", "TARDE", "TAXA", "TEMPO", "TENDA", "TENTA",
            "TENTAR", "TERRA", "TESTE", "TEXTO", "TINHA", "TIPO", "TIRAR", "TITULO", "TOCAR",
            "TOMAR", "TOQUE", "TORRE", "TOTAL", "TRACAR", "TRACO", "TRAJE", "TRAZER", "TRECHO",
            "TREMER", "TRENS", "TRIBO", "TROCO", "TROCAR", "TROVA", "TURMA", "UNICO", "UNIAO",
            "UNIDO", "URBES", "USADO", "USINA", "UTIL", "VAGAR", "VALER", "VALOR", "VAMOS",
            "VARIAR", "VAZIO", "VELHO", "VENDA", "VENDE", "VENCER", "VENTO", "VERDE", "VERAO",
            "VERSO", "VESTE", "VIAGEM", "VIAJAR", "VIDEO", "VIRAR", "VISTA", "VIVER", "VOLTA",
            "VOLTAR", "XADREZ", "ZANGA", "ZARPAR", "ZEBRA", "ZINCO", "ZOMBAR",
            // Palavras do Scrabble populares
            "DIVERSAO", "AMIGOS", "GANHAR", "PALAVRA", "JOGOS", "ANAGRAMA"
        )
        
        validWords.addAll(baseWords.map { it.uppercase() })
    }
    
    fun isValidWord(word: String): Boolean {
        val normalized = word.uppercase().trim()
        return normalized.length >= 2 && 
               (validWords.contains(normalized) || manuallyApprovedWords.contains(normalized))
    }
    
    fun addManuallyApprovedWord(word: String) {
        manuallyApprovedWords.add(word.uppercase().trim())
    }
    
    fun getWordCount(): Int = validWords.size + manuallyApprovedWords.size
}
