// Erro lançado quando os dados violam uma regra do domínio.
// Ter um tipo próprio permite às outras camadas distingui-lo de falhas técnicas (ex.: base de dados em baixo).
export class ErroDominio extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = "ErroDominio";
  }
}
