import { describe, expect, it } from "vitest";
import { contactsFromRows, parseCsv, readContactFile } from "./contactFile";

describe("reading an uploaded contact list", () => {
  it("reads an Excel CSV with a header, quotes and first/last name columns", () => {
    const csv = '﻿First Name,Last Name,Email Address,Phone,Company\r\nAda,Obi,ADA@Example.com,0803 000 0000,"Obi, Sons & Co"\r\nBola,,bola@example.com,,\r\nNo,Email,,0809,\r\nAda,Again,ada@example.com,,\r\n';
    const file = readContactFile("customers.csv", csv);
    expect(file.contacts).toEqual([
      { email: "ada@example.com", name: "Ada Obi", phone: "0803 000 0000", company: "Obi, Sons & Co" },
      { email: "bola@example.com", name: "Bola", phone: null, company: null },
    ]);
    expect(file.withoutEmail).toBe(1);
  });

  it("reads semicolon CSVs and Google Contacts exports", () => {
    expect(readContactFile("x.csv", "Name;E-mail\nTolu Ade;tolu@example.com\n").contacts[0]).toMatchObject({ email: "tolu@example.com", name: "Tolu Ade" });
    const google = "First Name,Middle Name,Last Name,E-mail 1 - Label,E-mail 1 - Value,Phone 1 - Value,Organization Name\nChidi,,Eze,* Home,chidi@example.com,+234 1,Eze Ltd\n";
    expect(readContactFile("contacts.csv", google).contacts[0]).toEqual({ email: "chidi@example.com", name: "Chidi Eze", phone: "+234 1", company: "Eze Ltd" });
  });

  it("finds the email column when there is no header", () => {
    const rows = parseCsv("Ada Obi,ada@example.com\nBola <bola@example.com>,\n\nbisi@example.com\n");
    expect(contactsFromRows(rows).contacts.map((c) => [c.email, c.name])).toEqual([
      ["ada@example.com", "Ada Obi"],
      ["bola@example.com", "Bola"],
      ["bisi@example.com", null],
    ]);
  });

  it("reads a vCard exported from a phone", () => {
    const vcf = "BEGIN:VCARD\r\nVERSION:3.0\r\nN:Obi;Ada;;;\r\nFN:Ada Obi\r\nEMAIL;TYPE=INTERNET:ada@example.com\r\nTEL;TYPE=CELL:0803\r\nORG:Obi Ltd;Sales\r\nEND:VCARD\r\nBEGIN:VCARD\r\nVERSION:3.0\r\nFN:No Email\r\nTEL:0809\r\nEND:VCARD\r\nBEGIN:VCARD\r\nN:Lawal;Bisi;;;\r\nitem1.EMAIL:bisi@example.com\r\nEND:VCARD\r\n";
    const file = readContactFile("phone.vcf", vcf);
    expect(file.contacts).toEqual([
      { email: "ada@example.com", name: "Ada Obi", phone: "0803", company: "Obi Ltd" },
      { email: "bisi@example.com", name: "Bisi Lawal", phone: null, company: null },
    ]);
    expect(file.withoutEmail).toBe(1);
  });
});
