import React , { Component } from 'react';
import PropTypes from 'prop-types';
import { CONFIG } from './config.js';
import axios from 'axios';

const _ = require("lodash")

class App extends Component{
    constructor(){
        super();
        
        this.state = {
          transactions: []
        }


        this.handleClick = this.handleClick.bind(this);
        this.inputFileChanged = this.inputFileChanged.bind(this);
    };

    handleClick(){
        let input = this.refs.input_reader;
        input.click();
    };

    componentDidMount(){
      let self = this;

      axios.all([
        axios.get(CONFIG.CASHIN_CONFIG),
        axios.get(CONFIG.CASHOUT_LEGAL_CONFIG),
        axios.get(CONFIG.CASHOUT_NATURAL_CONFIG),
      ]).then(axios.spread((cash_in,cash_out_legal, cash_out_natural) => {
        cash_in.data.percents = (cash_in.data.percents/100);
        cash_out_legal.data.percents = (cash_out_legal.data.percents/100);
        cash_out_natural.data.percents = (cash_out_natural.data.percents/100);
          self.setState({
            CASHIN : cash_in.data,
            CASHOUTLEGAL: cash_out_legal.data,
            CASHOUTNATURAL: cash_out_natural.data,
            SUPPORTEDCURRENCIES: CONFIG.SUPPORTED_CURRENCIES
          })
        }))
    }

    inputFileChanged(e){
      var file = e.target.files[0], self = this;
      var fr = new FileReader();
      fr.onload = parseFile;
      fr.readAsText(file);

    

      function parseFile(e) {
        var transactionList = JSON.parse(e.target.result); 
        self.processFile(transactionList);
      }

     
    }
    

    processFile(transactionList){
      let self = this, transactionResult = [];

      transactionList.forEach(data => {
        let commission_amount = null;

        if(data.type === "cash_in")
          commission_amount = cashIn(data.operation)        
        
        else if(data.type === "cash_out")
          commission_amount = cashOut(data)
      
        commission_amount = _.ceil(commission_amount, 3);

        transactionResult.push({"commission" : commission_amount, "user_id" : data.user_id, "transaction_type" : data.type, "week_number": getISO8601WeekNo(data.date), "transaction_amount": data.operation.amount, "user_type" : data.user_type })
      })
      
      

      function searchWeekTransactions(user_id, week_number){
        let transactionTotal = 0;

        for (let i=0; i < transactionResult.length; i++) {
            if (transactionResult[i].user_id === user_id && transactionResult[i].week_number === week_number && transactionResult[i].transaction_type === "cash_out" && transactionResult[i].user_type === "natural" ) 
                transactionTotal += transactionResult[i].transaction_amount;
        }

        return transactionTotal;
      }

      function cashIn(data){
        let commission = null;
        if(data.amount > 0 && self.state.SUPPORTEDCURRENCIES.includes(data.currency)){
          commission = data.amount * self.state.CASHIN.percents;

          if(commission >= self.state.CASHIN.max.amount)
            commission = self.state.CASHIN.max.amount;
        }
        else
          commission = "Invalid operation";
        
        return commission;
      }

      function cashOut(data){
        data.user_type.toLowerCase();
        let commission = null;
        
        if(data.user_type === "juridical" || data.user_type === "legal"){      

          commission = data.operation.amount * self.state.CASHOUTLEGAL.percents;

          if(commission < 0.5)
            commission = 0.5         
          
        }

        else if(data.user_type === "natural"){
          
          let amount = data.operation.amount;
          let weekNo = getISO8601WeekNo(data.date);
          let currentlyUsed = searchWeekTransactions(data.user_id, weekNo);
          console.log(currentlyUsed)
          if(currentlyUsed === 0){
            console.log(data.operation.amount);
            if(data.operation.amount >= 1000)  amount = data.operation.amount - 1000;       
            else amount = 0 ;                 
          }
          else if( currentlyUsed < 1000 && currentlyUsed > 0){
            amount = data.operation.amount + 1000 - currentlyUsed;
          } 
          console.log(amount);
          commission = amount * self.state.CASHOUTNATURAL.percents;
        }
        else
            commission = "Invalid operation";
        

        return commission;
      }
      
      function getISO8601WeekNo(date) {
        var split = date.split("-")
        date = new Date(split[2], split[1] - 1, split[0])
        let firstDay = (new Date(date.getFullYear(),0,1)).getDay();
        let firstMonday = (firstDay <= 1) ? (2 - firstDay) : (9 - firstDay);
        let wk = Math.ceil((date - (new Date(date.getFullYear(),0,firstMonday)))/(7*24*60*60*1000));
        wk = wk+(wk % 10 == 1 && wk != 11 ? 'st' : (wk % 10 == 2 && wk != 12 ? 'nd' : (wk % 10 == 3 && wk != 13 ? 'rd' : 'th')));
        return wk;
      }
      
      this.setState({
        transactions: transactionResult
      })
    }


    render(){       
      const { transactions } = this.state;
      
      let commission_list = null;

      if(transactions.length > 0)
        commission_list = transactions.map(function(data) {
          return (
            <div> { data.commission } </div>
          );
        });
        return(
            <div>
                <div>
                  <button onClick={this.handleClick}>Upload</button>
                  <input type="file" ref="input_reader" style={{display:'none'}} onChange={this.inputFileChanged.bind(this)}/>
                </div>
                { commission_list }
            </div>
        );
    }
}

export default App;