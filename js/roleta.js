// Número que mostra o nome de quem votou antes de mostrar o total novo.
// Vários votos seguidos: os nomes passam rápido, estilo roleta, e param no total.
export class Roleta {
  constructor(el) {
    this.el = el;
    this.el.classList.add("roleta");
    this.txt = document.createElement("span");
    this.txt.className = "roleta-txt";
    this.el.replaceChildren(this.txt);
    this.fila = [];
    this.final = 0;
    this.rodando = false;
    this.mostrar(String(this.final), false);
  }

  // atualização sem animação (estado geral); se estiver girando, só guarda o valor final
  definir(numero) {
    this.final = numero;
    if (!this.rodando) this.mostrar(String(numero), false, true);
  }

  votar(nome, numeroFinal) {
    this.final = numeroFinal;
    this.fila.push(nome);
    if (!this.rodando) this.girar();
  }

  mostrar(texto, ehNome, semAnimacao = false) {
    if (this.txt.textContent === texto && this.el.classList.contains("mostrando-nome") === ehNome) return;
    this.el.classList.toggle("mostrando-nome", ehNome);
    this.txt.textContent = texto;
    this.el.title = texto;
    if (semAnimacao) return;
    this.txt.classList.remove("troca");
    void this.txt.offsetWidth;
    this.txt.classList.add("troca");
  }

  async girar() {
    this.rodando = true;
    while (this.fila.length) {
      const nome = this.fila.shift();
      this.mostrar(nome, true);
      const restantes = this.fila.length;
      // com fila, cada nome fica menos tempo na tela
      const tempo = restantes ? Math.max(70, Math.min(380, 900 / (restantes + 1))) : 1300;
      await esperar(tempo);
    }
    this.mostrar(String(this.final), false);
    this.rodando = false;
  }
}

const esperar = ms => new Promise(r => setTimeout(r, ms));
