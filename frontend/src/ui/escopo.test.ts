import { beforeEach, describe, expect, it } from "vitest";
import { dados, defineDono, eu, tituloProjeto } from "@/state/estado";
import { avisoSemEquipes } from "@/features/painel";
import { seletorDono, soLeitura } from "./formularios";

const membro = (id: string, nome: string) => ({ id, nome, ativo: true }) as (typeof dados.equipe)[number];

beforeEach(() => {
  eu.id = "eu";
  dados.equipe = [membro("eu", "Bruno"), membro("ana", "Ana"), membro("carla", "Carla")];
  dados.atribuiveis = [];
  dados.escopo = { ve_tudo: false, lider: false, liderados: 0, equipes: 0 };
  dados.projetos = [];
  dados.referenciasProjetos = [];
});

describe("seletorDono", () => {
  it("quem não lidera vê o dono fixo: em registro novo, ele mesmo", () => {
    expect(defineDono()).toBe(false);
    const s = String(seletorDono("Responsável", null, true));
    expect(s).toContain('type="hidden" name="responsavel_id" value="eu"');
    expect(s).toContain("Bruno (você)");
    expect(s).not.toContain("<select");
  });

  it("registro existente de outra pessoa continua com o dono atual, sem troca", () => {
    const s = String(seletorDono("Responsável", "ana", false));
    expect(s).toContain('value="ana"');
    expect(s).toContain("Ana");
  });

  it("líder escolhe entre si e os liderados, e pode deixar sem dono", () => {
    dados.escopo = { ve_tudo: false, lider: true, liderados: 1, equipes: 1 };
    dados.atribuiveis = [{ id: "eu", nome: "Bruno" }, { id: "carla", nome: "Carla" }];
    const s = String(seletorDono("Responsável", "carla", false));
    expect(s).toContain("<select");
    expect(s).toContain("Sem responsável");
    expect(s).toContain('value="carla" selected');
    expect(s).not.toContain('value="ana"');
  });

  it("líder abrindo registro de alguém fora da árvore mantém o dono atual na lista", () => {
    dados.escopo = { ve_tudo: false, lider: true, liderados: 1, equipes: 1 };
    dados.atribuiveis = [{ id: "eu", nome: "Bruno" }];
    expect(String(seletorDono("Responsável", "ana", false))).toContain('value="ana" selected');
  });
});

describe("somente leitura e avisos", () => {
  it("só pode_editar === false é leitura (ausente vale edição)", () => {
    expect(soLeitura({ pode_editar: false })).toBe(true);
    expect(soLeitura({ pode_editar: true })).toBe(false);
    expect(soLeitura({})).toBe(false);
    expect(soLeitura(undefined)).toBe(false);
  });

  it("avisa o admin enquanto não houver equipes", () => {
    expect(String(avisoSemEquipes())).toBe("");
    dados.escopo = { ve_tudo: true, lider: false, liderados: 0, equipes: 0 };
    expect(String(avisoSemEquipes())).toContain("Monte as equipes");
    dados.escopo = { ve_tudo: true, lider: false, liderados: 0, equipes: 2 };
    expect(String(avisoSemEquipes())).toBe("");
  });

  it("título do projeto vem das referências quando a pessoa só executa a tarefa", () => {
    dados.referenciasProjetos = [{ id: "p1", titulo: "Portal" }];
    expect(tituloProjeto("p1")).toBe("Portal");
    expect(tituloProjeto("p2")).toBe("");
  });
});
