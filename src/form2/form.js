import React, { useState, useEffect } from "react";
import FieldGroup from ".//fieldGroup";
import Field from ".//field";
import Option from ".//option";
import Handlebars from "handlebars";

const fieldMeetsCondition = (values) => (field) => {
  if (field.conditional && field.conditional.field) {
    const segments = field.conditional.field.split("_");
    const fieldId = segments[segments.length - 1];
    return values[fieldId] === field.conditional.value;
  }
  return true;
};

const Form = ({ formData }) => {
  // state to track the current page ID of the form
  const [page, setPage] = useState(0);

  // state to track the current form data that will be displayed
  const [currentPageData, setCurrentPageData] = useState(formData[page]);

  // track the values of the form fields
  const [values, setValues] = useState({});

  // state to track the generated snippet
  const [snippet, setSnippet] = useState("");

  // setSnippet = (snippet) => {
  //   setSnippet(snippet);
  // }
  
  // this effect will run when the `page` changes
  useEffect(() => {
    const upcomingPageData = formData[page];
    setCurrentPageData(upcomingPageData);
    setValues((currentValues) => {
      const newValues = upcomingPageData.fields.reduce((obj, field) => {
        if (field.component === "field_group") {
          for (const subField of field.fields) {
            obj[subField._uid] = "";
          }
        } else {
          obj[field._uid] = "";
        }

        return obj;
      }, {});

      return Object.assign({}, newValues, currentValues);
    });
  }, [page, formData]);

  // callback provided to components to update the main list of form values
  const fieldChanged = (fieldId, value) => {
    // use a callback to find the field in the value list and update it
    setValues((currentValues) => {
      currentValues[fieldId] = value;
      return currentValues;
    });

    // this just fakes that we've updated the `currentPageData` to force a re-render in React
    setCurrentPageData((currentPageData) => {
      return Object.assign({}, currentPageData);
    });
  };

  const navigatePages = (direction) => () => {
    const findNextPage = (page) => {
      const upcomingPageData = formData[page];
      if (upcomingPageData.conditional && upcomingPageData.conditional.field) {
        // we're going to a conditional page, make sure it's the right one
        const segments = upcomingPageData.conditional.field.split("_");
        const fieldId = segments[segments.length - 1];

        const fieldToMatchValue = values[fieldId];

        if (fieldToMatchValue !== upcomingPageData.conditional.value) {
          // if we didn't find a match, try the next page
          return findNextPage(direction === "next" ? page + 1 : page - 1);
        }
      }
      // all tests for the page we want to go to pass, so go to it
      return page;
    };

    setPage(findNextPage(direction === "next" ? page + 1 : page - 1));
  };

  const nextPage = navigatePages("next");
  const prevPage = navigatePages("prev");

  // const generatedText = `doSomethingUponClick = () => {<br/> 
  // //do the  ${values.functionHandlerName}
  // }`;

  // const generatedText2 = () => {
  //   var template = Handlebars.compile("Handlebars <b>{{doesWhat}}</b>");
  //   console.log(template({ doesWhat: "rocks!" }));
  //   return template({ doesWhat: "rocks!" });
  // };

  const onSubmit = (e) => {
    e.preventDefault();
    console.log('entered onSubmit');
    console.log('values: ' + JSON.stringify(values));
  };

  // const generateSnippet = () => {
  //   console.log('entered generateSnippet');
  //   setSnippet(generatedText2());
  //   //return 'clicked button';
  // };

  // const generateSnippet2 = () => {
  //   console.log('entered generateSnippet2');
  //   var template = Handlebars.compile("Handlebars <b>{{doesWhat}}</b>");
  //   let generatedSnippet = template({ doesWhat: "rocks!" });
  //   setSnippet(generatedSnippet);
  // };

  // const generateSnippet2 = () => {
  //   console.log('entered generateSnippet2');
  //   var template = Handlebars.compile("Handlebars <b>{{{codeSnippet}}}</b>");
  //   let generatedSnippet = template(currentPageData);
  //   setSnippet(generatedSnippet);
  // };


  const generateSnippet2 = () => {
    //currentPageData object holds the data for the form fields. 
    //  It is set in formData.js
    var template = Handlebars.compile(currentPageData.codeSnippet);
    //The values object holds the form values. It is defined at top of this file.
    let generatedSnippet = template(values);
    //setSnippet is defined indirectly at the top of this file. Via the Hooks functionality in React.
    setSnippet(generatedSnippet);
  };

  return (
    <>
        
    <form onSubmit={onSubmit}>
      <h2>{currentPageData.label}</h2>
      {currentPageData.fields
        .filter(fieldMeetsCondition(values))
        .map((field) => {
          switch (field.component) {
            case "field_group":
              return (
                <FieldGroup
                  key={field._uid}
                  field={field}
                  fieldChanged={fieldChanged}
                  // should probably only slice out the required values, but ¯\_(ツ)_/¯
                  values={values}
                />
              );
            case "options":
              return (
                <Option
                  key={field._uid}
                  field={field}
                  fieldChanged={fieldChanged}
                  value={values[field._uid]}
                />
              );
            default:
              return (
                <Field
                  key={field._uid}
                  field={field}
                  fieldChanged={fieldChanged}
                  value={values[field._uid]}
                />
              );
          }
        })}
      {page > 0 && <button onClick={prevPage}>Back</button>}&nbsp;
      {page < formData.length - 1 && <button onClick={nextPage}>Next</button>}
      <hr />
    </form>
    <button onClick = { generateSnippet2 }> Generate Snippet</button>
    <div>
      {snippet}
    </div>

    </>

  );
};

export default Form;
