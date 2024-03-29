import { select, templates, settings, classNames } from "../settings.js";
import AmountWidget from "./AmountWidget.js";
import DatePicker from "./DatePicker.js";
import HourPicker from "./HourPicker.js";
import {utils} from '../utils.js';

class Booking {
    constructor(element) {
        const thisBooking = this;

        thisBooking.selectedTable = null;
        
        thisBooking.render(element);
        thisBooking.initWidgets();
        thisBooking.getData();
    }

    getData(){
        const thisBooking = this;

        const startDateParam = settings.db.dateStartParamKey + '=' + utils.dateToStr(thisBooking.datePicker.minDate);
        const endDateParam = settings.db.dateEndParamKey + '=' + utils.dateToStr(thisBooking.datePicker.maxDate);
        
        const params = {
            bookings: [
                startDateParam,
                endDateParam,
            ],
            eventsCurrent: [
                settings.db.notRepeatParam,
                startDateParam,
                endDateParam,

            ],
            eventsRepeat: [
                settings.db.repeatParam,
                endDateParam,
            ],

        };

        //console.log('getData params', params);

        const urls = {
            bookings:       settings.db.url + '/' + settings.db.bookings + '?' + params.bookings.join('&'),
            eventsCurrent: settings.db.url + '/' + settings.db.events   + '?' + params.eventsCurrent.join('&'),
            eventsRepeat:  settings.db.url + '/' + settings.db.events   + '?' + params.eventsRepeat.join('&'),
        };
        //console.log(urls);
        Promise.all([
            fetch(urls.bookings),
            fetch(urls.eventsCurrent),
            fetch(urls.eventsRepeat),
        ])       
        .then(function(allResponses){
            const bookingsResponse = allResponses[0];
            const eventsCurrentResponse = allResponses[1];
            const eventsRepeatResponse = allResponses[2];

            return Promise.all([
                bookingsResponse.json(),
                eventsCurrentResponse.json(),
                eventsRepeatResponse.json(),
            ]);
        })
        .then(function([bookings, eventsCurrent, eventsRepeat]){
            // console.log(bookings);
            // console.log(eventsCurrent);
            // console.log(eventsRepeat);
            thisBooking.parseData(bookings, eventsCurrent, eventsRepeat);
        });
    }

    parseData(bookings, eventsCurrent, eventsRepeat){
        const thisBooking = this;

        thisBooking.booked = {};

        for(let item of eventsCurrent){
            thisBooking.makeBooked(item.date, item.hour, item.duration, item.table);
        }

        for(let item of bookings){
            thisBooking.makeBooked(item.date, item.hour, item.duration, item.table);
        }

        const minDate = thisBooking.datePicker.minDate;
        const maxDate = thisBooking.datePicker.maxDate;

        for(let item of eventsRepeat){
            if(item.repeat == 'daily'){
                for(let loopDate = minDate; loopDate <= maxDate; loopDate = utils.addDays(loopDate, 1)){
                    thisBooking.makeBooked(utils.dateToStr(loopDate), item.hour, item.duration, item.table);
                }
            }
        }

        //console.log('thisBooking.booked', thisBooking.booked);

        thisBooking.updateDOM();
    }

    makeBooked(date, hour, duration, table){
        const thisBooking = this;

        if(typeof thisBooking.booked[date] == 'undefined'){
            thisBooking.booked[date] = {};
        }

        const startHour = utils.hourToNumber(hour);

        

        for(let hourBlock = startHour; hourBlock < startHour + duration; hourBlock += 0.5){
            //console.log('loop', hourBlock);

            if(typeof thisBooking.booked[date][hourBlock] == 'undefined'){
                thisBooking.booked[date][hourBlock] = [];
            }
    
            thisBooking.booked[date][hourBlock].push(table);
        }
    }

    updateDOM(){
        const thisBooking = this;

        thisBooking.date = thisBooking.datePicker.value;
        thisBooking.hour = utils.hourToNumber(thisBooking.hourPicker.value);

        let allAvailable = false;

        if(
            typeof thisBooking.booked[thisBooking.date] == 'undefined'
            ||
            typeof thisBooking.booked[thisBooking.date][thisBooking.hour] == 'undefined'
        ){
            allAvailable = true;
        }

        for(let table of thisBooking.dom.tables){
            let tableId = table.getAttribute(settings.booking.tableIdAttribute);
            if(!isNaN(tableId)){
                tableId = parseInt(tableId);
            }

            if(
                !allAvailable
                &&
                thisBooking.booked[thisBooking.date][thisBooking.hour].includes(tableId)
            ){
                table.classList.add(classNames.booking.tableBooked);
            } else {
                table.classList.remove(classNames.booking.tableBooked);
            }
        }
    }

    render(element){
        const thisBooking = this;

        const generatedHTML = templates.bookingWidget();

        thisBooking.dom = {};

        thisBooking.dom.wrapper = element;
        thisBooking.dom.wrapper.innerHTML = generatedHTML;

        thisBooking.dom.peopleAmount = element.querySelector(select.booking.peopleAmount);
        thisBooking.dom.hoursAmount = element.querySelector(select.booking.hoursAmount);

        thisBooking.dom.datePicker = element.querySelector(select.widgets.datePicker.wrapper);
        thisBooking.dom.hourPicker = element.querySelector(select.widgets.hourPicker.wrapper);

        thisBooking.dom.tables = element.querySelectorAll(select.booking.tables);
        thisBooking.dom.allTables = element.querySelector(select.booking.allTables);

        thisBooking.dom.phone = element.querySelector(select.booking.phone);
        thisBooking.dom.address = element.querySelector(select.booking.address);
        thisBooking.dom.bookTable = element.querySelector(select.booking.bookTable);
        thisBooking.dom.starters = element.querySelectorAll(select.booking.starters);
        thisBooking.dom.form = element.querySelector(select.booking.form);

    }

    initWidgets(){
        const thisBooking = this;

        thisBooking.peopleAmount = new AmountWidget(thisBooking.dom.peopleAmount);
        thisBooking.dom.peopleAmount.addEventListener('updated', function(){

        });

        thisBooking.hoursAmount = new AmountWidget(thisBooking.dom.hoursAmount);
        thisBooking.dom.hoursAmount.addEventListener('updated', function(){

        });

        thisBooking.datePicker = new DatePicker(thisBooking.dom.datePicker);
        thisBooking.dom.datePicker.addEventListener('updated', function(){

        });

        thisBooking.hourPicker = new HourPicker(thisBooking.dom.hourPicker);
        thisBooking.dom.hourPicker.addEventListener('updated', function(){

        });

        thisBooking.dom.wrapper.addEventListener('updated', function(){
            thisBooking.updateDOM();
            thisBooking.resetTables();
        })

        thisBooking.dom.allTables.addEventListener('click', function(event){
            thisBooking.initTables(event);
        });

        thisBooking.dom.form.addEventListener('submit', function(event){
            event.preventDefault();
            thisBooking.sendBooking();
        });
    }

    initTables(event){
        const thisBooking = this;

        /*check if clicked on table */
        const clickedElement = event.target;

        if(!clickedElement.classList.contains(classNames.booking.table))
            return;
        
        if(clickedElement.classList.contains(classNames.booking.tableBooked)){
            alert('This table is already booked. Please select a different table');
            return;
        }

        const clickedTable = clickedElement;
        console.log('clickedTable', clickedTable);

        /*check if theres already a selected table and if there is remove class .selected from it */
        let tableId = clickedTable.getAttribute(settings.booking.tableIdAttribute);

        console.log('tableId', tableId);
    
        if(thisBooking.selectedTable && thisBooking.selectedTable !== tableId){
            const selectedTable = thisBooking.dom.allTables.querySelector(select.booking.selectedTable);
            console.log('selectedTable', selectedTable);
            if(selectedTable !== null){
                selectedTable.classList.remove(classNames.booking.selectTable);
            }
        }

        /*add clicked table to thisBooking.selectedTable and add .selected class to it */
        if(!clickedTable.classList.contains(classNames.booking.selectTable)){
            thisBooking.selectedTable = tableId;
            clickedTable.classList.add(classNames.booking.selectTable);
        } 
        else {
            if(clickedTable.classList.contains(classNames.booking.selectTable)){
                clickedTable.classList.remove(classNames.booking.selectTable);
                thisBooking.selectedTable = null;
            }
        }
            console.log('thisBooking.selectedTable', thisBooking.selectedTable);
    }

    resetTables() {
        const thisBooking = this;

        for(let table of thisBooking.dom.tables){
            table.classList.remove(classNames.booking.selectTable);
        }
    }

    selectStarters(){
        const thisBooking = this;

        const selectedStarters = [];

        for(let starter of thisBooking.dom.starters) {
            if(starter.checked) {
                selectedStarters.push(starter.value);
            }
        }

        return selectedStarters;
    }

    sendBooking(){
        const thisBooking = this;
  
        const url = settings.db.url + '/' + settings.db.bookings;

        const selectedStarters = thisBooking.selectStarters();
        
        const payload = {
          date: thisBooking.datePicker.value,
          hour: thisBooking.hourPicker.value,
          table: parseInt(thisBooking.selectedTable),
          duration: parseInt(thisBooking.hoursAmount.value),
          ppl: parseInt(thisBooking.peopleAmount.value),
          starters: selectedStarters,
          phone: thisBooking.dom.phone.value,
          address: thisBooking.dom.address.value,
        }
  
        const options = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        };
  
        fetch(url, options)
            .then(() => {
                thisBooking.makeBooked(
                    payload.date,
                    payload.hour,
                    payload.duration,
                    payload.table
                );
                thisBooking.updateDOM();
                thisBooking.resetTables();
                console.log('table booked', payload);
            })
          
      }

    
}

export default Booking;