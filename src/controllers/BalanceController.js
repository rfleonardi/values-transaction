import { PrismaClient } from "@prisma/client";
import useUtils from "../utils/Helper.js";

const prisma = new PrismaClient();
const utils = useUtils();


const balanceFomrat = async (array, accountNumber) => {
  return await Promise.all(array.map(async item => ({
    ticketStart: parseInt(item.ticketStart),
    ticketEnd: parseInt(item.ticketEnd),
    unitPrice: utils.formatMoney(await utils.getUnitPrice(item.ticketStart, accountNumber)),
    quantity: utils.getQuantity(accountNumber, item.ticketStart, item.ticketEnd),
    amount: utils.formatMoney(await utils.getAmount(accountNumber, item.ticketStart, item.ticketEnd))
  })));
}


const getBalanceData = async (array, accountNumber, entity) => {
  const inflows = [];

  for(const item of array) {
    const inflow = await prisma.ticket.findFirstOrThrow({
      include: {
        transaction: {
          include: {
            journal: true,
            user: true
          }
        }
      },
      where: {
        ticketStart: {
          lte: parseInt(item.ticketStart)
        },
        ticketEnd: {
          gte: parseInt(item.ticketStart)
        },
        transaction: {
          accountNumber: accountNumber,
          type: 'inflow',
          entity: entity
        }
       },
       orderBy: {
        ticketStart: 'desc'
       }
    });

    inflows.push(inflow);
  }

  return await Promise.all(inflows.map(async (item, index) => ({
    ticketId: item.ticketId,
    orderNumber: item.transaction.orderNumber === null ? '' : item.transaction.orderNumber,
    ticketStart: parseInt(array[index].ticketStart),
    ticketEnd: parseInt(array[index].ticketEnd),
    unitPrice: utils.formatMoney(await utils.getUnitPrice(parseInt(array[index].ticketStart), accountNumber)),
    quantity: utils.getQuantity(accountNumber, parseInt(array[index].ticketStart), parseInt(array[index].ticketEnd)),
    amount: utils.formatMoney(await utils.getAmount(accountNumber, parseInt(array[index].ticketStart), parseInt(array[index].ticketEnd))),
    transactionId: item.transactionId,
    date: item.transaction.date,
    responsible: item.transaction.responsible === null ? '' :  item.transaction.responsible, 
    userIm: item.transaction.userIm,
    username: item.transaction.user.username,
    editable: false
  })));
}


const balancesPerNature = async (accountNumber, exercise, entity) => {
  const date = (exercise.length === 4 || typeof(exercise) === "number") ? exercise.toString() + '-12-12' : exercise;
  const year = (exercise.length === 4 || typeof(exercise) === "number") ? exercise.toString() : (new Date(exercise)).getFullYear().toString();

  const balances = await prisma.$queryRaw`
    WITH inflows AS (
      SELECT 
          K.ticketStart, 
          K.ticketEnd
      FROM Transaction T
      JOIN Ticket K ON T.transactionId = K.transactionId
      WHERE T.type = 'inflow'
      AND T.entity = ${entity}
      AND T.accountNumber = ${accountNumber}
       AND T.date <= ${date}
    ),
    outflows AS (
      SELECT 
        K.ticketStart, 
        K.ticketEnd
      FROM Transaction T
      JOIN Ticket K ON T.transactionId = K.transactionId
      WHERE T.type = 'outflow'
      AND T.entity = ${entity}
      AND T.accountNumber = ${accountNumber}
       AND T.date <= ${date}
    ),
    ranges AS (
        SELECT ticketStart, ticketEnd FROM inflows
        UNION ALL
        SELECT ticketStart, ticketEnd FROM outflows
    ),
    split_ranges AS (
      SELECT ticketStart, 
               LEAD(ticketStart) OVER (ORDER BY ticketStart) - 1 AS ticketEnd
        FROM (
            SELECT DISTINCT ticketStart FROM ranges
            UNION
            SELECT DISTINCT ticketEnd + 1 FROM ranges
        ) AS boundaries
    ),
    valid_ranges AS (
      SELECT K.ticketStart, K.ticketEnd 
      FROM Ticket K
      JOIN Transaction T ON K.transactionId = T.transactionId
      WHERE T.entity = ${entity}
      AND T.accountNumber = ${accountNumber}
       AND T.date <= ${date}
    )
    SELECT sr.ticketStart, sr.ticketEnd
    FROM split_ranges sr
    JOIN valid_ranges vr ON sr.ticketStart BETWEEN vr.ticketStart AND vr.ticketEnd
    WHERE sr.ticketStart <= sr.ticketEnd
      AND NOT EXISTS (
          SELECT 1 
          FROM outflows O
          WHERE O.ticketStart <= sr.ticketEnd
           AND O.ticketEnd >= sr.ticketStart
      )
    ORDER BY sr.ticketStart
  `;  
  
  const balancesFormatted = await getBalanceData(balances, accountNumber, entity);
  const totalAmount = await utils.getTotalAmount(balances, accountNumber);

  return {
    balances: balancesFormatted,
    totalAmount: totalAmount
  };
}


const paymentBalancesPerNatures = async (accountNumber, exercise) => {
  const date = (exercise.length === 4 || typeof(exercise) === "number") ? exercise.toString() + '-12-12' : exercise;
  const year = (exercise.length === 4 || typeof(exercise) === "number") ? exercise.toString() : (new Date(exercise)).getFullYear().toString();

  const balances = await prisma.$queryRaw`
    WITH inflows AS (
      SELECT 
          K.ticketStart, 
          K.ticketEnd
      FROM Transaction T
      JOIN Ticket K ON T.transactionId = K.transactionId
      WHERE T.type = 'inflow'
      AND T.entity = 'accountant'
      AND T.accountNumber = ${accountNumber}
      AND T.date <= ${date}
    ),
    outflows AS (
      SELECT 
        K.ticketStart, 
        K.ticketEnd
    FROM Transaction T
    JOIN Ticket K ON T.transactionId = K.transactionId
    WHERE T.type = 'outflow'
    AND T.entity = 'manager'
      AND T.accountNumber = ${accountNumber}
      AND T.date <= ${date}
    ),
    ranges AS (
        SELECT ticketStart, ticketEnd FROM inflows
        UNION ALL
        SELECT ticketStart, ticketEnd FROM outflows
    ),
    split_ranges AS (
        SELECT ticketStart,
               LEAD(ticketStart) OVER (ORDER BY ticketStart) - 1 AS ticketEnd
        FROM (
            SELECT DISTINCT ticketStart FROM ranges
            UNION
            SELECT DISTINCT ticketEnd + 1 FROM ranges
        ) AS boundaries
    ),
    valid_ranges AS (
      SELECT K.ticketStart, K.ticketEnd 
      FROM Ticket K
      JOIN Transaction T ON K.transactionId = T.transactionId
      AND T.accountNumber = ${accountNumber}
      AND T.date <= ${date}
    )
    SELECT sr.ticketStart, sr.ticketEnd
    FROM split_ranges sr
    JOIN valid_ranges vr ON sr.ticketStart BETWEEN vr.ticketStart AND vr.ticketEnd
    WHERE sr.ticketStart <= sr.ticketEnd
      AND NOT EXISTS (
          SELECT 1 
          FROM outflows O
          WHERE O.ticketStart <= sr.ticketEnd
          AND O.ticketEnd >= sr.ticketStart
      )
    GROUP BY sr.ticketStart
    ORDER BY sr.ticketStart
  `;  

  const balancesFormatted = await balanceFomrat(balances, accountNumber);
  const totalAmount = await utils.getTotalAmount(balances, accountNumber);

  return {
    balances: balancesFormatted,
    totalAmount: totalAmount
  };
}


const allTransactionBalances = async (exercise, entity) => {
  const journal = await prisma.journal.findMany();
   
  const amounts = await Promise.all(journal.map(async (item) => {
    return (await balancesPerNature(item.accountNumber, exercise, entity)).totalAmount
  }));

  const totalAmount = amounts.reduce((acc, amount) => acc + amount, 0);

  return {
    amounts: amounts,
    totalAmount: totalAmount
  };
}


const allPaymentBalances = async (exercise) => {
  const journal = await prisma.journal.findMany();
   
  const amounts = await Promise.all(journal.map(async (item) => {
    return (await paymentBalancesPerNatures(item.accountNumber, exercise)).totalAmount
  }));

   const totalAmount = amounts.reduce((acc, amount) => acc + amount, 0);

  return {
    amounts: amounts,
    totalAmount: totalAmount
  };
}


const lastExercisesBalances = async (entity) => {
  const exercises = await utils.getAllExercises();
  const lastExercises = [];

  exercises.map(item => {
    if(lastExercises.length < 5)
      lastExercises.push(item)
  });

  lastExercises.sort();

  const amounts = await Promise.all(lastExercises.map(async (item) => {
    return entity === undefined ? (await allPaymentBalances(item)).totalAmount : (await allTransactionBalances(item, entity)).totalAmount
  }));

  return {
    exercises: lastExercises,
    amounts: amounts
  };
}


/* select all balances per nature */
const getBalancesPerNature = async (req, res) => {
  const { accountNumber, exercise, entity } = req.body;

  try {
    res.status(200).json(await balancesPerNature(accountNumber, exercise, entity));
  } catch(error) {
    console.error(error);
    res.status(500).json({error: error});
  }
}


const getAllTransactionBalances = async (req, res) => {
  const { exercise, entity } = req.body;

  try {
    res.status(200).json(await allTransactionBalances(exercise, entity));
  } catch(error) {
    console.error(error);
    res.status(500).json({error: error});
  }
}


const getLastExercisesTransactionBalances = async (req, res) => {
  const { entity } = req.body;

  try {
    res.status(200).json(await lastExercisesBalances(entity));
  } catch(error) {
    console.error(error);
    res.status(500).json({error: error});
  }
}


const getPaymentBalancesPerNatures = async (req, res) => {
  const { accountNumber, exercise } = req.body;

  try {
    res.status(200).json(await paymentBalancesPerNatures(accountNumber, exercise));
  } catch(error) {
    console.error(error);
    res.status(500).json({error: error});
  }
}


const getAllPaymentBalances = async (req, res) => {
  const { exercise } = req.body;

  try {
    res.status(200).json(await allPaymentBalances(exercise));
  } catch(error) {
    console.error(error);
    res.status(500).json({error: error});
  }
}


const getLastExercisesPaymentBalances = async (req, res) => {
  try {
    res.status(200).json(await lastExercisesBalances());
  } catch(error) {
    console.error(error);
    res.status(500).json({error: error});
  }
}


/* 
  debit 1 ===> type = 'inflow', entity = 'accountant'
  credit 1 ===> type = 'outflow', entity = 'accountant'
  debit 2 ===> type = 'inflow', entity = 'manager'
  credit 2 ===> type = 'outflow', entity = 'manager'
  debit 3 ===> type = 'outflow', entity = 'manager'
  credit 3 ===> type = 'inflow', entity = 'accountant'
*/
const getInProgressTransaction = async (accountNumber, type, entity, exercise) => {
    const date = exercise.length === 4 ? exercise + '-12-12' : exercise;
    const year = exercise.length === 4 ? exercise : (new Date(exercise)).getFullYear().toString();

    const result = await prisma.$queryRaw`
      SELECT SUM((ticketEnd - ticketStart + 1) * unitPrice) AS total FROM Ticket
      JOIN Transaction ON Ticket.transactionId = Transaction.transactionId
      WHERE accountNumber = ${accountNumber}
        AND type = ${type}
        AND entity = ${entity}
        AND (YEAR(STR_TO_DATE(date, '%Y-%m-%d')) = ${year} AND date <= ${date})
    `;

    const total = result.length != 0 ? result[0].total : 0;

    return accountNumber !== '1' ?
      (
        accountNumber !== '852' ?
        total * 1 :
        total * 50
      ) :
      total * 5
}


const getAllInProgressTransaction = async (req, res) => {
  const { type, entity, exercise } = req.body;

  const journal = await prisma.journal.findMany();

  const transactions = await Promise.all(journal.map(async (item) => {
    return await getInProgressTransaction(item.accountNumber, type, entity, exercise)
  }));

  const total = transactions.reduce((acc, amount) => acc + amount, 0);

  res.status(200).json({
    totalPerNature: transactions,
    totalAmount: total
  });
}


export {
  balancesPerNature,
  getBalancesPerNature,
  getPaymentBalancesPerNatures,
  getAllInProgressTransaction,
  getAllTransactionBalances,
  getLastExercisesTransactionBalances,
  getAllPaymentBalances,
  getLastExercisesPaymentBalances
}