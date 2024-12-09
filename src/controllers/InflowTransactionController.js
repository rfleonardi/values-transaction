import { PrismaClient } from "@prisma/client";
import useUtils from "../utils/Helper.js";
import { balancesPerNature } from "./BalanceController.js";

const prisma = new PrismaClient();
const utils = useUtils();
const emptyFieldError = "Fill in the fields carefully";


const getFirstLessTicket = async (ticketNumber, accountNumber) => {
  const result = await prisma.$queryRaw`
    SELECT MAX(result) AS res FROM (
      SELECT MAX(ticketStart) AS result FROM Ticket, Transaction
      WHERE ticketStart < ${ticketNumber}
        AND Ticket.transactionId = Transaction.transactionId
        AND Transaction.type = 'inflow'
        AND Transaction.entity = 'accountant'
        AND Transaction.accountNumber = ${accountNumber}
      UNION 
      SELECT MAX(ticketEnd) AS result FROM Ticket, Transaction
      WHERE ticketEnd < ${ticketNumber}
        AND Ticket.transactionId = Transaction.transactionId
        AND Transaction.type = 'inflow'
        AND Transaction.entity = 'accountant'
        AND Transaction.accountNumber = ${accountNumber}
    ) AS derive_table
  `;

  return result[0] ? result[0].res : null;
}


const getFirstGreatestTicket = async (ticketNumber, accountNumber) => {
  const result = await prisma.$queryRaw`
    SELECT MIN(result) AS res FROM (
      SELECT MIN(ticketStart) AS result FROM Ticket, Transaction 
      WHERE ticketStart > ${ticketNumber}
        AND Ticket.transactionId = Transaction.transactionId
        AND Transaction.type = 'inflow'
        AND Transaction.entity = 'accountant'
        AND Transaction.accountNumber = ${accountNumber}
      UNION 
      SELECT MIN(ticketEnd) AS result FROM Ticket, Transaction
      WHERE ticketEnd > ${ticketNumber}
        AND Ticket.transactionId = Transaction.transactionId
        AND Transaction.type = 'inflow'
        AND Transaction.entity = 'accountant'
        AND Transaction.accountNumber = ${accountNumber}
    ) AS derive_table
  `;

  return result[0] ? result[0].res : null;
}


const invalidTicketNumberAccountantInflow = async(ticketId, ticketNumber, targetTicket, firstCouple, secondCouple, accountNumber) => {
  const result = await prisma.$queryRaw`
    SELECT * FROM Ticket
    JOIN Transaction ON Ticket.transactionId = Transaction.transactionId
    WHERE (
      (
        (${ticketNumber} BETWEEN ${firstCouple[0]} AND ${firstCouple[1]}
          AND ${ticketNumber} BETWEEN ${secondCouple[0]} AND ${secondCouple[1]})
        AND ${ticketId} = -1)
      OR ${ticketNumber} IN (
        (
          SELECT ticketEnd AS result FROM Ticket
          JOIN Transaction ON Ticket.transactionId = Transaction.transactionId
          WHERE ${ticketId} = -1
            AND accountNumber = ${accountNumber}
          UNION 
          SELECT ticketStart AS result FROM Ticket
          JOIN Transaction ON Ticket.transactionId = Transaction.transactionId
          WHERE ${ticketId} = -1
            AND accountNumber = ${accountNumber}
        )
        UNION
        (
          SELECT ticketEnd AS result FROM Ticket 
          JOIN Transaction ON Ticket.transactionId = Transaction.transactionId
          WHERE ${ticketId} != -1 
            AND ticketEnd NOT BETWEEN ${targetTicket.ticketStart} AND ${targetTicket.ticketEnd}
            AND accountNumber = ${accountNumber}
          UNION 
          SELECT ticketStart AS result FROM Ticket 
          JOIN Transaction ON Ticket.transactionId = Transaction.transactionId
          WHERE ${ticketId} != -1 
            AND ticketStart NOT BETWEEN ${targetTicket.ticketStart} AND ${targetTicket.ticketEnd}
            AND accountNumber = ${accountNumber}
        )
      )
      OR (
        EXISTS (
            SELECT 1 
            FROM Ticket 
            JOIN Transaction ON Ticket.transactionId = Transaction.transactionId
            WHERE ${ticketId} != -1 
            AND ticketStart NOT BETWEEN ${targetTicket.ticketStart} AND ${targetTicket.ticketEnd}
            AND ticketEnd NOT BETWEEN ${targetTicket.ticketStart} AND ${targetTicket.ticketEnd}
            AND ${ticketNumber} BETWEEN ticketStart AND ticketEnd
            AND accountNumber = ${accountNumber}
        )
      )
    ) 
    AND Transaction.type = 'inflow'
    AND Transaction.entity = 'accountant'
    AND Transaction.accountNumber = ${accountNumber}
  `;

  return result.length != 0;
}


const invalidTicketStartManagerInflow = async (ticketId, ticketNumber, targetTicket, accountNumber) => {
  const result = await prisma.$queryRaw`
    SELECT * FROM Ticket
    JOIN Transaction ON Ticket.transactionId = Transaction.transactionId
    WHERE (
      ( 
        ${ticketId} = -1
      ) OR (
        ${ticketId} != -1
        AND ticketStart NOT BETWEEN ${targetTicket.ticketStart} AND ${targetTicket.ticketEnd}
      )
    ) AND ${ticketNumber} BETWEEN ticketStart AND ticketEnd
    AND type = 'inflow'
    AND entity = 'manager'
    AND accountNumber = ${accountNumber}
  `;

  return result.length != 0;
}


const invalidTicketEndManagerInflow = async (ticketId, ticketNumber, targetTicket, accountNumber) => {
  const result = await prisma.$queryRaw`
    SELECT * FROM Ticket
    JOIN Transaction ON Ticket.transactionId = Transaction.transactionId
    WHERE (
      ( 
        ${ticketId} = -1
      ) OR (
        ${ticketId} != -1
        AND ticketEnd NOT BETWEEN ${targetTicket.ticketStart} AND ${targetTicket.ticketEnd}
      )
    ) AND ${ticketNumber} BETWEEN ticketStart AND ticketEnd
    AND type = 'inflow'
    AND entity = 'manager'
    AND accountNumber = ${accountNumber}
  `;
  
  return result.length != 0;
}


const inflowsPerNature = async (accountNumber, exercise, entity) => {
  const date = exercise.length === 4 ? exercise + '-12-12' : exercise;
  const year = exercise.length === 4 ? exercise : (new Date(exercise)).getFullYear().toString();

  const inflows = await prisma.ticket.findMany({
    include: {
      transaction: {
        include: {
          journal: true,
          user: true
        }
      }
    },
    where: {
      transaction: {
        accountNumber: accountNumber,
        type: 'inflow',
        date: {
          startsWith: year,
          lte: date
        },
        entity: entity
      }
     },
     orderBy: {
      ticketStart: 'desc'
     }
  });
  
  const inflowsFormatted = (await utils.formatTransaction(inflows, accountNumber)).concat((await balancesPerNature(accountNumber, (parseInt(year) - 1).toString(), entity)).balances);
  const debit = await utils.getTotalAmount(inflows, accountNumber);
  const totalAmount = debit + (await balancesPerNature(accountNumber, (parseInt(year) - 1).toString(), entity)).totalAmount; 
    
  return {
    inflows: inflowsFormatted,
    totalAmount: totalAmount,
    debit: debit
  };
}


const allInflows = async (exercise, entity) => {
  const journal = await prisma.journal.findMany();
   
  const amounts = await Promise.all(journal.map(async (item) => {
    return (await inflowsPerNature(item.accountNumber, exercise, entity)).debit
  }));

  const totalAmount = amounts.reduce((acc, amount) => acc + amount, 0);

  return {
    amounts: amounts,
    totalAmount: totalAmount
  };
}


/* select all inflows' transaction per nature */
const getInflowsPerNature = async (req, res) => {
  const { accountNumber, exercise, entity } = req.body;

  try {
    res.status(200).json(await inflowsPerNature(accountNumber, exercise, entity));
  } catch (error) {
    console.error(error);
    res.status(500).json({error: error});
  }
}


const getAllInflows = async (req, res) => {
  const { exercise, entity } = req.body; 

  try {
    res.status(200).json(await allInflows(exercise, entity));
  } catch (error) {
    console.error(error);
    res.status(500).json({error: error});
  }
}

/* validate order number */
const validateOrderNumber = async (req, res) => {
  const { ticketId } = req.params;
  const { orderNumber, exercise, date } = req.body;

  try {
    return res.json(await utils.invalidOrderNumber(ticketId, orderNumber, exercise, date));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error });
  }
}

/* insert or update a accountant's transaction inflow type */
const upsertAccountantInflow = async (req, res) => {
  let errors = [];
  const { ticketId } = req.params;
  const { orderNumber, ticketStart, ticketEnd, unitPrice, date, accountNumber, userIm, responsible, exercise } = req.body;

  if(!ticketStart && !ticketEnd && !unitPrice && !date && !accountNumber && !userIm)
    errors.push(emptyFieldError);

  try {
    let updatedTicket = {
      ticketStart: null,
      ticketEnd: null
    };

    if(ticketId != -1)
      updatedTicket = await prisma.ticket.findUnique({ where: { ticketId: parseInt(ticketId) }});

    if(await utils.invalidOrderNumber(ticketId, orderNumber, exercise, date))
      errors.push("Invalid order number");

    if(ticketStart > ticketEnd)
      errors.push("ticketStart must not greater than ticketEnd");

    const x = await utils.getTicketsCouple(await getFirstLessTicket(ticketStart, accountNumber), 'inflow', 'accountant', accountNumber);
    const y = await utils.getTicketsCouple(await getFirstGreatestTicket(ticketStart, accountNumber), 'inflow', 'accountant', accountNumber);
    const w = await utils.getTicketsCouple(await getFirstLessTicket(ticketEnd, accountNumber), 'inflow', 'accountant', accountNumber);
    const z = await utils.getTicketsCouple(await getFirstGreatestTicket(ticketEnd, accountNumber), 'inflow', 'accountant', accountNumber);

    const invalidUpdatedTicketsInflow = await prisma.$queryRaw`
      SELECT * FROM Ticket
      JOIN Transaction ON Ticket.transactionId = Transaction.transactionId
      WHERE ticketStart > ${ticketStart}
        AND ${ticketEnd} > ${utils.getFirstGreatestStartTicket(ticketStart, 'inflow', 'accountant', accountNumber)}
        AND ${utils.getFirstGreatestStartTicket(ticketStart, 'inflow', 'accountant', accountNumber)} = ${updatedTicket.ticketStart}
        AND ${utils.getFirstGreatestStartTicket(ticketStart, 'inflow', 'accountant', accountNumber)} IS NOT NULL
        AND Transaction.entity = 'accountant'
        AND Transaction.type = 'inflow'
        AND Transaction.accountNumber = ${accountNumber}
    `;

    const invalidTicketStart = await invalidTicketNumberAccountantInflow(ticketId, ticketStart, updatedTicket, x, y, accountNumber);
    const invalidTicketEnd = await invalidTicketNumberAccountantInflow(ticketId, ticketEnd, updatedTicket, w, z, accountNumber);

    if(invalidTicketStart && invalidTicketEnd)
      errors.push("Invalid ticketStart and ticketEnd");

    if(invalidTicketStart)
      errors.push("Invalid ticketStart");

    if(invalidTicketEnd)
      errors.push("Invalid ticketEnd");

    if(invalidUpdatedTicketsInflow.length != 0 && ticketId != -1)
      errors.push("Check ticketStart or ticketEnd");

    const minMaxTicketsOutflow  = await utils.getMinMaxTicketsOutflow(updatedTicket.ticketStart, updatedTicket.ticketEnd, 'accountant', accountNumber);

    if(minMaxTicketsOutflow.min !== null && minMaxTicketsOutflow.max !== null) {
      if(ticketId != -1 && ticketStart > minMaxTicketsOutflow.min)
        errors.push("Invalid ticketStart");
  
      if(ticketId != -1 && ticketEnd < minMaxTicketsOutflow.max)
        errors.push("Invalid ticketEnd");
    }

    if(await utils.getLastDate(ticketId, ticketStart, 'inflow', 'accountant', accountNumber) > date || new Date(date) > new Date())
      errors.push("Invalid date");

    const invalidDateOrOrderNumber = await utils.invalidDateOrOrderNumber(orderNumber, ticketStart, date, 'inflow', 'accountant', accountNumber);

    if(invalidDateOrOrderNumber.orderNumber)
      errors.push("Invalid order number by tickets number");

    if(invalidDateOrOrderNumber.date)
      errors.push("Invalid date by tickets number");

    if(errors.length > 0)
      return res.status(400).json({ errors: errors });

    let ticket;

    if(ticketId == -1) {
      ticket = await prisma.ticket.create({
        data: {
          ticketStart,
          ticketEnd,
          unitPrice,
          transaction: {
            create: {
              orderNumber,
              type: 'inflow',
              entity: 'accountant',
              date,
              responsible,
              accountNumber,
              userIm 
            }
          }
        }
      });
    } else {
      ticket = await prisma.ticket.update({
        where: { ticketId: parseInt(ticketId) },
        data: {
          ticketStart,
          ticketEnd,
          unitPrice,
          transaction: {
            update: {
              orderNumber,
              date,
              responsible,
              userIm 
            }
          }
        }
      });
    }
  
    res.status(201).json({
      message: ticketId == -1 ? "Item added successfully" : "Item updated successfully",
      ticket: ticket
    });
  } catch(error) {
    console.error(error);
    res.status(500).json({ error: error });
  }
}


/* insert or update a manager's transaction inflow type */
const upsertManagerInflow = async (req, res) => {
  let errors = [];
  const { ticketId } = req.params;
  const { orderNumber, ticketStart, ticketEnd, unitPrice, date, responsible, accountNumber, userIm, exercise } = req.body;

  if(!orderNumber && !ticketStart && !ticketEnd && !unitPrice && !date && !responsible && !accountNumber && !userIm)
    errors.push(emptyFieldError);

  try {
    let updatedTicket = {
      ticketStart: null,
      ticketEnd: null
    };

    const redirectToAccountant = await prisma.$queryRaw`
      SELECT * FROM Ticket
      JOIN Transaction ON Ticket.transactionId = Transaction.transactionId
      WHERE (${ticketStart} BETWEEN ticketStart AND ticketEnd
        OR ${ticketEnd} BETWEEN ticketStart AND ticketEnd)
      AND type = 'inflow'
      AND entity = 'accountant'
      AND accountNumber = ${accountNumber}
    `;

    if(redirectToAccountant.length > 0) {
      errors.push("Redirect to accountant");
      return res.status(400).json({ errors: errors });
    }

    if(ticketId != -1)
      updatedTicket = await prisma.ticket.findUnique({ where: { ticketId: parseInt(ticketId) }});

    if(await utils.invalidOrderNumber(ticketId, orderNumber, exercise, date))
      errors.push("Invalid order number");

    if(ticketStart > ticketEnd)
      errors.push("ticketStart must not greater than ticketEnd");

    const invalidTicketStart = await invalidTicketStartManagerInflow(ticketId, ticketStart, updatedTicket, accountNumber);
    const invalidTicketEnd = await invalidTicketEndManagerInflow(ticketId, ticketEnd, updatedTicket, accountNumber);

    if(invalidTicketStart && invalidTicketEnd)
      errors.push("Invalid ticketStart and ticketEnd");

    if(invalidTicketStart)
      errors.push("Invalid ticketStart");

    if(invalidTicketEnd)
      errors.push("Invalid ticketEnd");

    const x = await utils.getFirstGreatestStartTicket(ticketStart, accountNumber);
    const y = await utils.getFirstGreatestStartTicket(ticketEnd, accountNumber);
    const z = await utils.getFirstGreatestStartTicket(ticketStart, accountNumber);
    const w = await utils.getFirstGreatestStartTicket(ticketEnd, accountNumber);

    if(x != y && z != w)
      errors.push("Check ticketStart or ticketEnd");

    const minMaxTicketsOutflow  = await utils.getMinMaxTicketsOutflow(updatedTicket.ticketStart, updatedTicket.ticketEnd, 'manager', accountNumber);

    if(minMaxTicketsOutflow.min !== null && minMaxTicketsOutflow.max !== null) {
      if(ticketId != -1 && ticketStart > minMaxTicketsOutflow.min)
        errors.push("Invalid ticketStart");
  
      if(ticketId != -1 && ticketEnd < minMaxTicketsOutflow.max)
        errors.push("Invalid ticketEnd");
    }

    if(await utils.getLastDate(ticketId, ticketStart, 'inflow', 'manager', accountNumber) > date)
      errors.push("Invalid date");

    const invalidDateOrOrderNumber = await utils.invalidDateOrOrderNumber(orderNumber, ticketStart, date, 'inflow', 'manager', accountNumber);

    if(invalidDateOrOrderNumber.orderNumber)
      errors.push("Invalid order number by tickets number");

    if(invalidDateOrOrderNumber.date)
      errors.push("Invalid date by tickets number");

    if(errors.length > 0)
      return res.status(400).json({ errors: errors });

    let ticket;

    if(ticketId == -1) {
      ticket = await prisma.ticket.create({
        data: {
          ticketStart,
          ticketEnd,
          unitPrice,
          transaction: {
            create: {
              orderNumber,
              type: 'inflow',
              entity: 'manager',
              date,
              responsible,
              accountNumber,
              userIm 
            }
          }
        }
      });
    } else {
      ticket = await prisma.ticket.update({
        where: { ticketId: parseInt(ticketId) },
        data: {
          ticketStart,
          ticketEnd,
          unitPrice,
          transaction: {
            update: {
              orderNumber,
              date,
              responsible,
              userIm 
            }
          }
        }
      });
    }

    res.status(200).json({
      message: ticketId == -1 ? "Item added successfully" : "Item updated successfully",
      ticket: ticket
    });
  } catch(error) {
    console.error(error);
    res.status(500).json({ error: error });
  }
}


const deleteTransaction = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { type, entity, accountNumber } = req.body;
    const ticket = await prisma.ticket.findUnique({ where : { ticketId: parseInt(ticketId) }});
    
    if(type === 'inflow' && entity === 'accountant') {
      await prisma.ticket.deleteMany({
        where: {
          ticketStart: {
            gte: ticket.ticketStart,
            lte: ticket.ticketEnd
          },
          ticketEnd: {
            gte: ticket.ticketStart,
            lte: ticket.ticketEnd
          },
          transaction: {
            accountNumber: accountNumber
          }
        }
      });
    }

    else if((type === 'outflow' && entity === 'accountant') || (type === 'inflow' && entity === 'manager')) {
      await prisma.ticket.deleteMany({
        where: {
          ticketStart: {
            gte: ticket.ticketStart,
            lte: ticket.ticketEnd
          },
          ticketEnd: {
            gte: ticket.ticketStart,
            lte: ticket.ticketEnd
          },
          transaction: {
            OR: [
              { type: { not: 'inflow' } },
              { entity : { not: 'accountant' } }
            ],
            accountNumber: accountNumber
          }
        }
      });
    }

    else {
      await prisma.ticket.delete({
        where: { 
          ticketId : parseInt(ticket.ticketId),
          transaction: {
            accountNumber: accountNumber
          }
        }
      })
    }

    res.status(200).json({ message: "items deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({error: error});
  }
}


export {
  getInflowsPerNature,
  getAllInflows,
  validateOrderNumber,
  upsertAccountantInflow,
  upsertManagerInflow,
  deleteTransaction
}