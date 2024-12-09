import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();


export default function useUtils() {
  const formatDate = (value) => {
    return value.split('-').reverse().join('-');
  }

  const getUnitPrice = async (ticketNumber, accountNumber) => {
    const result = await prisma.$queryRaw`
      SELECT unitPrice FROM Ticket
      JOIN Transaction ON Ticket.transactionId = Transaction.transactionId
      WHERE 
        ${ticketNumber} BETWEEN ticketStart AND ticketEnd
        AND accountNumber = ${accountNumber}
      LIMIT 1
    `;
  
    return result[0] ? result[0].unitPrice : null;
  }


  const getAllExercises = async () => {
    const actualExercise = (new Date).getFullYear();
    const exercises = [actualExercise];

    const result = await prisma.$queryRaw`
      SELECT YEAR(STR_TO_DATE(date, '%Y-%m-%d')) AS year FROM Transaction
      WHERE date < ${actualExercise}
      GROUP BY year ORDER BY year DESC
    `;

    result.map(item => exercises.push(item.year));

    return exercises;
  }
  
  
  const getFirstGreatestStartTicket = async (ticketNumber, transactionType, transactionEntity, accountNumber) => {
    const result = await prisma.$queryRaw`
      SELECT MIN(ticketStart) AS res FROM Ticket, Transaction
      WHERE ticketStart > ${ticketNumber}
        AND Ticket.transactionId = Transaction.transactionId
        AND Transaction.type = ${transactionType}
        AND Transaction.entity = ${transactionEntity}
        AND Transaction.accountNumber = ${accountNumber}
    `;
  
    return result[0] ? result[0].res : null;
  }


  const getLastDate = async (ticketId, ticketNumber, transactionType, transactionEntity, accountNumber) => {
    const result = await prisma.$queryRaw`
      SELECT date FROM Ticket
      JOIN Transaction ON Ticket.transactionId = Transaction.transactionId
      WHERE ticketEnd < ${ticketNumber}
        AND type = ${transactionType}
        AND entity = ${transactionEntity}
        AND accountNumber = ${accountNumber}
      ORDER BY ticketEnd DESC
    `;

    return result[0] ? (ticketId !== -1 ? (result[1] ? result[1].date : null) : result[0].date) : null;
  }
  
  
  const getTicketsCouple = async (ticketNumber, transactionType, transactionEntity, accountNumber) => {
    let result;
  
    const complementaryTicket = await prisma.$queryRaw`
      SELECT ticketEnd AS result FROM Ticket, Transaction 
      WHERE ticketStart = ${ticketNumber}
        AND Ticket.transactionId = Transaction.transactionId
        AND Transaction.type =  ${transactionType}
        AND Transaction.entity = ${transactionEntity}
        AND Transaction.accountNumber = ${accountNumber}
      UNION 
      SELECT ticketStart AS result FROM Ticket, Transaction
      WHERE ticketEnd = ${ticketNumber}
        AND Ticket.transactionId = Transaction.transactionId
        AND Transaction.type =  ${transactionType}
        AND Transaction.entity = ${transactionEntity}
        AND Transaction.accountNumber = ${accountNumber}
    `;
  
    const queryResult = complementaryTicket[0] ? complementaryTicket[0].result : null;
  
    if(ticketNumber < queryResult)
      result = [ticketNumber, queryResult];
    else
      result = [queryResult, ticketNumber];
  
    return result;
  }

  const getMinMaxTicketsOutflow = async (ticketStart, ticketEnd, entity, accountNumber) => {
    const result = await prisma.$queryRaw`
      SELECT MIN(ticketStart) AS min, MAX(ticketEnd) as max
      FROM Ticket
      JOIN Transaction ON Transaction.transactionId = Ticket.transactionId
      WHERE ticketStart BETWEEN ${ticketStart} AND ${ticketEnd}
        AND ticketEnd BETWEEN ${ticketStart} AND ${ticketEnd}
        AND type = 'outflow'
        AND entity = ${entity}
        AND accountNumber = ${accountNumber}
    `;

    return {
      min: result[0].min,
      max: result[0].max
    }
  }

  const invalidOrderNumber = async (ticketId, orderNumber, exercise, date) => {
    let updatedTransaction = {
      orderNumber: ''
    };
    
    if(ticketId != -1) {
      updatedTransaction = await prisma.transaction.findFirst({
        where: {
          ticket: {
            ticketId: parseInt(ticketId)
          }
        }
      })
    }

    const targetTransaction = await prisma.$queryRaw`
      SELECT date AS date FROM Transaction
      WHERE ${orderNumber} = orderNumber
        AND ${orderNumber} != ''
        AND ${exercise} = YEAR(STR_TO_DATE(date, '%Y-%m-%d'))
      LIMIT 1
    `;

    const result = await prisma.$queryRaw`
      SELECT * FROM Transaction
      WHERE (
        (
          ${ticketId} = -1
        )
        OR (
          ${ticketId} != -1
          AND ${orderNumber} != ${updatedTransaction.orderNumber}
        )
      ) AND ${orderNumber} = orderNumber
      AND ${orderNumber} != ''
      AND ${exercise} = YEAR(STR_TO_DATE(date, '%Y-%m-%d'))
      AND ${formatDate(date)} != ${targetTransaction.length > 0 ? (targetTransaction[0])["date"] : null}
    `;

    return result.length > 0 ;
  }

  const invalidDateOrOrderNumber = async (orderNumber, ticketStart, date, type, entity, accountNumber) => {
    const targetTransaction = await prisma.$queryRaw`
      SELECT date, orderNumber FROM Transaction
      JOIN Ticket ON Transaction.transactionId = Ticket.transactionId
      WHERE ticketStart < ${ticketStart}
        AND orderNumber != ''
        AND type = ${type}
        AND entity = ${entity}
        AND accountNumber = ${accountNumber}
      ORDER BY ticketStart DESC
      LIMIT 1
    `;

    return {
      date: date < (targetTransaction.length > 0 ? (targetTransaction[0])["date"] : null),
      orderNumber: orderNumber < (targetTransaction.length > 0 ? (targetTransaction[0])["orderNumber"] : null)
    };
  }

  const getQuantity = (accountNumber, ticketStart, ticketEnd) => {
    return  accountNumber !== '1' ?
      (accountNumber !== '852' ?
       (parseInt(ticketEnd) - parseInt(ticketStart) + 1) :
       (parseInt(ticketEnd) - parseInt(ticketStart) + 1) * 50
      ) :
      (parseInt(ticketEnd) - parseInt(ticketStart) + 1) * 5
  }

  const getAmount = async (accountNumber, ticketStart, ticketEnd) => {
    return (getQuantity(accountNumber, ticketStart, ticketEnd)) * (await getUnitPrice(ticketStart, accountNumber));
  }

  const formatMoney = (value) => {
    const string = value.toString();
    
    const parts = string.split('.');
    
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

    if (parts[1] === undefined) 
        parts[1] = '00';
    else if (parts[1].length === 1)
        parts[1] += '0';
    else 
      parts[1] = parts[1].slice(0, 2);

    return parts.join(',');
  }


  const getTotalAmount = async (array, accountNumber) => {
    let amounts = await Promise.all(array.map(async (item) => {
      return await getAmount(accountNumber, item.ticketStart, item.ticketEnd)
    }));
  
    return amounts.reduce((acc, amount) => acc + amount, 0);
  }


  const formatTransaction = async (array, accountNumber) => {
    return await Promise.all(array.map(async item => ({
      ticketId: item.ticketId,
      orderNumber: item.transaction.orderNumber === null ? '' : item.transaction.orderNumber,
      ticketStart: item.ticketStart,
      ticketEnd: item.ticketEnd,
      unitPrice: formatMoney(await getUnitPrice(item.ticketStart, item.transaction.accountNumber)),
      quantity: getQuantity(accountNumber, item.ticketStart, item.ticketEnd),
      amount: formatMoney(await getAmount(accountNumber, item.ticketStart, item.ticketEnd)),
      transactionId: item.transactionId,
      date: item.transaction.date,
      responsible: item.transaction.responsible === null ? '' :  item.transaction.responsible, 
      userIm: item.transaction.userIm,
      username: item.transaction.user.username,
      editable: true
    })));
  }


  return {
    getUnitPrice,
    getAllExercises,
    getFirstGreatestStartTicket,
    getLastDate,
    getTicketsCouple,
    getMinMaxTicketsOutflow,
    invalidOrderNumber,
    invalidDateOrOrderNumber,
    getQuantity,
    getAmount,
    formatMoney,
    getTotalAmount,
    formatTransaction,
  }
} 
