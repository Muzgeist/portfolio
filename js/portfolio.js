function idade(){

    let atual = new Date();

    let nascimento = new Date (2006,6,23);

    let idade = atual.getFullYear() - nascimento.getFullYear();

    let mesAtual = atual.getMonth();
    let diaAtual = atual.getDate();

    let mesNascimento = nascimento.getMonth();
    let diaNascimento = nascimento.getDate();

    if (
        mesAtual < mesNascimento ||
        (mesAtual === mesNascimento && diaAtual < diaNascimento)
    ) {
        idade--;
    }

    let pidade = document.getElementById("idade");

    pidade.textContent = idade;

}