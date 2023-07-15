import React, { Component } from 'react';
import './App.css';
import Form from "./form2/form";
import { formData } from "./formData";
export default class App extends Component {

    constructor(props) {
        super(props);
    }

    render = () =>
    <div className="App">
        <Form formData={formData} />
      </div>

}
