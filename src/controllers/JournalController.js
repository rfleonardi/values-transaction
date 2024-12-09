import { PrismaClient } from "@prisma/client";
import useUtils from "../utils/Helper.js";

const prisma = new PrismaClient();
const utils = useUtils();


const getAllJournals = async (req, res) => {
  const list = await prisma.journal.findMany();

  let natures = [];
  let accounts = [];

  list.map(item => {
    natures.push(item.nature);
    accounts.push(item.accountNumber);
  });

  res.status(200).json({
    natures: natures,
    accounts: accounts
  });
}


const getAccountNumber = async (req, res) => {
  const { nature } = req.body;
  const journal = await prisma.journal.findFirst({
    where: { nature },
    select: { accountNumber: true }
  });

  res.status(200).json(journal.accountNumber);
}


const getAllExercises = async (req, res) => {
  res.status(200).json(await utils.getAllExercises());
}


export {
  getAllJournals,
  getAccountNumber,
  getAllExercises
}